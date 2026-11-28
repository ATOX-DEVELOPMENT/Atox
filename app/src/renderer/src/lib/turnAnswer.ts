import type { TimelineItem } from '../../../shared/conversation'

type ToolItem = Extract<TimelineItem, { kind: 'tool' }>

/** Инструменты, которыми агент ведёт свои записи: список дел и задачи. Это не работа над ответом. */
const BOOKKEEPING_TOOLS: ReadonlySet<string> = new Set([
  'TodoWrite',
  'TaskCreate',
  'TaskUpdate',
  'TaskGet',
  'TaskList'
])

/**
 * Папка памяти агента — `…/projects/<проект>/memory/`: в неё он пишет и файлом, и командой
 * в терминале (`cat > …/memory/заметка.md <<EOF` или `cd …/memory && cat > заметка.md`).
 */
const MEMORY_PATH = /\/projects\/[^/]+\/memory(?:\/|["'\s]|$)/
/** Перенаправления, которые ничего не записывают: `2>&1`, `>/dev/null`. */
const HARMLESS_REDIRECT = /\d*>&\d|\d*>\s*\/dev\/null/g
/** Команда что-то записывает: перенаправление в файл или `tee`. */
const WRITES = />|\btee\b/

/**
 * Служебный вызов: агент записал себе что-то на будущее, а не сделал что-то для ответа.
 * Чтение памяти — работа: агент собирает ответ из своих заметок.
 */
function isBookkeeping(item: ToolItem): boolean {
  if (BOOKKEEPING_TOOLS.has(item.name)) {
    return true
  }
  if (!MEMORY_PATH.test(item.title)) {
    return false
  }
  return (
    item.tool === 'edit' ||
    (item.tool === 'command' && WRITES.test(item.title.replace(HARMLESS_REDIRECT, '')))
  )
}

const hasText = (item: TimelineItem) => item.kind === 'assistant' && item.text !== ''

const isBookkeepingCall = (item: TimelineItem) => item.kind === 'tool' && isBookkeeping(item)

/**
 * Какой текст агента — ответ в законченном ходе, а не рассказ о работе. Ответ — всё, что он
 * написал после последнего настоящего действия: команды, правки, поиска, вопроса к человеку.
 * Служебные записи (память, список дел) ответ не обрывают: «вот итог… (записал себе правило)
 * …и ещё приписка» — итог тоже ответ, даже если агент написал его в размышлениях, а текстом —
 * только приписку. Остальные размышления в ответ не входят. Если после последнего действия
 * агент ничего не написал, ответ — его последний текст.
 */
export function answerIndices(items: readonly TimelineItem[]): ReadonlySet<number> {
  const lastWork = items.findLastIndex(
    (item) =>
      (item.kind === 'tool' && !isBookkeeping(item)) ||
      item.kind === 'approval' ||
      item.kind === 'question'
  )
  const lastBookkeeping = items.findLastIndex(isBookkeepingCall)
  const answer = items.flatMap((item, index) =>
    index > lastWork &&
    (hasText(item) ||
      (item.kind === 'reasoning' && item.text.trim() !== '' && index < lastBookkeeping))
      ? [index]
      : []
  )
  if (answer.length > 0) {
    return new Set(answer)
  }
  const last = items.findLastIndex(hasText)
  return new Set(last >= 0 ? [last] : [])
}
