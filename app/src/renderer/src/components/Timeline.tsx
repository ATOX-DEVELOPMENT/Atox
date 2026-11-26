import { memo, useEffect, useMemo, useState, type ReactNode } from 'react'
import {
  ArrowUp,
  ChevronRight,
  CircleAlert,
  FoldVertical,
  FileText,
  Image as ImageIcon,
  GripVertical,
  LoaderCircle,
  Pencil,
  RotateCw,
  Trash2,
  WifiOff
} from 'lucide-react'
import type { TimelineItem, TimelineItemKind, UserMessage } from '../../../shared/conversation'
import { findAgent } from '../../../shared/agents'
import {
  compactionText,
  formatDuration,
  formatTokens,
  toolVerb,
  workingLabel
} from '../lib/conversationText'
import { fileName, useImagePreview } from '../lib/attachments'
import { ImageViewer } from './ImageViewer'
import { GeneratedImage } from './GeneratedImage'
import { imageContextMenu, type ShownImage } from '../lib/imageActions'
import { AgentIcon } from './AgentIcon'
import { ApprovalCard } from './ApprovalCard'
import { QuestionCard } from './QuestionCard'
import { Markdown } from './Markdown'
import { SortableList, useSortableItem } from './SortableList'
import { ContextCard, LimitsCard } from './UsageCards'

type UserItem = UserMessage
type CompactionItem = Extract<TimelineItem, { kind: 'compaction' }>

type Block =
  | { type: 'user'; item: UserItem }
  /** Ответ на сообщение: всё, что агент делал и писал, пока отвечал. */
  | { type: 'turn'; key: string; user: UserItem; items: TimelineItem[] }
  /** Запись до первого сообщения в чате. */
  | { type: 'entry'; item: TimelineItem }

/**
 * Что в законченном ответе сворачивается в «Worked for»: промежуточный текст агента, его
 * действия и разрешения, которые он спрашивал по ходу. Ошибки, картинки, карточки `/usage` и
 * `/context` и сжатие разговора остаются на виду.
 */
const FOLDED_KINDS: ReadonlySet<TimelineItemKind> = new Set([
  'assistant',
  'tool',
  'reasoning',
  'approval',
  'question',
  'reconnect'
])

/**
 * Сообщение моложе этого только что отправлено и появляется с анимацией; старые сообщения
 * при открытии чата появляются сразу.
 */
const FRESH_MESSAGE_MS = 2000

/** Как часто обновлять секундомер работающего агента. */
const CLOCK_INTERVAL_MS = 1000

/**
 * Сколько законченный ответ остаётся развёрнутым, прежде чем свернуться в «Worked for». Claude
 * может закончить ход и тут же продолжить сам — например, когда пришёл результат фоновой
 * задачи. Без паузы ответ в этот миг сворачивался и разворачивался обратно: текст пропадал.
 */
const FOLD_DELAY_MS = 3000

interface TimelineProps {
  chatId: string
  items: readonly TimelineItem[]
  /** Сообщения, которые ждут, пока агент закончит текущий ответ, — под лентой. */
  queued: readonly UserMessage[]
  running: boolean
  /** Сколько токенов агент написал, отвечая на текущее сообщение. */
  turnTokens: number
  /** Чат на экране: секундомер скрытого чата не тикает. */
  visible: boolean
}

export const Timeline = memo(function Timeline({
  chatId,
  items,
  queued,
  running,
  turnTokens,
  visible
}: TimelineProps) {
  const blocks = useMemo(() => buildBlocks(items), [items])
  const lastTurn = blocks.findLast((block) => block.type === 'turn')
  const unfolded = useFoldDelay(running)
  return (
    <div className="timeline">
      {blocks.map((block) => {
        switch (block.type) {
          case 'user':
            return <UserMessageView key={block.item.id} item={block.item} />
          case 'entry':
            return <TimelineEntry key={block.item.id} chatId={chatId} item={block.item} />
          case 'turn':
            return (
              <Turn
                key={block.key}
                chatId={chatId}
                user={block.user}
                items={block.items}
                // Агент мог продолжить сам — после фоновой задачи, — когда ответ уже закончен:
                // его работа всё равно относится к последнему сообщению и видна по ходу.
                live={running && block === lastTurn}
                unfolded={unfolded && block === lastTurn}
                tokens={turnTokens}
                visible={visible}
              />
            )
        }
      })}
      <QueuedMessages chatId={chatId} items={queued} />
    </div>
  )
})

/** Сообщение пользователя в ленте. */
function UserMessageView({ item }: { item: UserItem }) {
  return (
    <div
      className="user-message"
      data-fresh={Date.now() - item.createdAt < FRESH_MESSAGE_MS || undefined}
    >
      <UserMessageBody item={item} />
    </div>
  )
}

function UserMessageBody({ item }: { item: UserItem }) {
  return (
    <>
      {(item.images || item.files) && (
        <MessageAttachments images={item.images ?? []} files={item.files ?? []} />
      )}
      {item.text && <div className="message message--user">{item.text}</div>}
    </>
  )
}

interface QueuedMessagesProps {
  chatId: string
  items: readonly UserMessage[]
}

/**
 * Сообщения, которые ждут, пока агент закончит текущий ответ. Их можно отправить сразу,
 * поправить, убрать и переставить перетаскиванием.
 */
function QueuedMessages({ chatId, items }: QueuedMessagesProps) {
  // Порядок после перетаскивания, пока очередь из main его не подтвердила: иначе сообщение
  // на миг прыгнуло бы назад.
  const [moved, setMoved] = useState<{ from: readonly UserMessage[]; ids: string[] } | null>(null)
  const ordered =
    moved?.from === items
      ? moved.ids.flatMap((id) => items.find((item) => item.id === id) ?? [])
      : items
  if (ordered.length === 0) {
    return null
  }
  const move = (id: string, toIndex: number) => {
    const ids = ordered.map((item) => item.id).filter((other) => other !== id)
    ids.splice(toIndex, 0, id)
    setMoved({ from: items, ids })
    void window.atox.conversations.reorderQueued(chatId, ids)
  }
  return (
    <div className="queued-messages">
      <SortableList items={ordered} onMove={move}>
        {(item) => <QueuedMessage key={item.id} chatId={chatId} item={item} />}
      </SortableList>
    </div>
  )
}

/** Сообщение в очереди: приглушено, действия — при наведении. */
function QueuedMessage({ chatId, item }: { chatId: string; item: UserMessage }) {
  const [draft, setDraft] = useState<string | null>(null)
  const editing = draft !== null
  const { itemProps, handleProps } = useSortableItem(item.id, editing)
  const { conversations } = window.atox

  const save = () => {
    if (draft !== null && draft.trim() !== item.text) {
      void conversations.editQueued(chatId, item.id, draft)
    }
    setDraft(null)
  }

  return (
    <li
      {...itemProps}
      className="user-message queued-message"
      data-queued
      data-editing={editing || undefined}
    >
      {editing ? (
        <>
          {(item.images || item.files) && (
            <MessageAttachments images={item.images ?? []} files={item.files ?? []} />
          )}
          <textarea
            className="queued-message__editor"
            value={draft}
            autoFocus
            rows={Math.min(10, Math.max(2, draft.split('\n').length))}
            aria-label="Edit the queued message"
            onFocus={(event) => event.currentTarget.select()}
            onChange={(event) => setDraft(event.target.value)}
            onKeyDown={(event) => {
              if (event.key === 'Escape') {
                event.preventDefault()
                setDraft(null)
              } else if (event.key === 'Enter' && !event.shiftKey && !event.nativeEvent.isComposing) {
                event.preventDefault()
                save()
              }
            }}
          />
          <div className="queued-message__edit-actions">
            <button type="button" className="queued-message__text-button" onClick={() => setDraft(null)}>
              Cancel
            </button>
            <button
              type="button"
              className="queued-message__text-button queued-message__text-button--primary"
              onClick={save}
            >
              Save
            </button>
          </div>
        </>
      ) : (
        <>
          <div className="queued-message__row">
            <button
              type="button"
              className="queued-message__handle"
              aria-label="Drag to reorder"
              title="Drag to reorder"
              {...handleProps}
            >
              <GripVertical />
            </button>
            <div className="queued-message__body">
              <UserMessageBody item={item} />
            </div>
          </div>
          <div className="queued-message__actions">
            <IconAction
              label="Send now"
              hint="Stop the current reply and send this message now"
              onClick={() => void conversations.sendQueuedNow(chatId, item.id)}
            >
              <ArrowUp />
            </IconAction>
            {item.text && (
              <IconAction label="Edit" hint="Edit" onClick={() => setDraft(item.text)}>
                <Pencil />
              </IconAction>
            )}
            <IconAction
              label="Delete"
              hint="Remove from the queue"
              onClick={() => void conversations.cancelQueued(chatId, item.id)}
            >
              <Trash2 />
            </IconAction>
          </div>
        </>
      )}
    </li>
  )
}

interface IconActionProps {
  label: string
  hint: string
  onClick(): void
  children: ReactNode
}

function IconAction({ label, hint, onClick, children }: IconActionProps) {
  return (
    <button
      type="button"
      className="queued-message__action"
      aria-label={label}
      title={hint}
      onClick={onClick}
    >
      {children}
    </button>
  )
}

interface MessageAttachmentsProps {
  images: readonly string[]
  files: readonly string[]
}

/**
 * Вложения сообщения одним рядом над его текстом: картинки, затем файлы. Клик по картинке
 * открывает её на весь экран.
 */
function MessageAttachments({ images, files }: MessageAttachmentsProps) {
  const [viewed, setViewed] = useState<ShownImage | null>(null)
  return (
    <ul className="message__attachments">
      {images.map((path) => (
        <MessageImage key={path} path={path} onOpen={setViewed} />
      ))}
      {files.map((path) => (
        <li key={path} className="message__file" title={path}>
          <FileText className="icon" aria-hidden />
          <span className="message__file-name">{fileName(path)}</span>
        </li>
      ))}
      {viewed && <ImageViewer image={viewed} onClose={() => setViewed(null)} />}
    </ul>
  )
}

/** Картинка из сообщения: превью, пока файл читается или пропал, — значок. */
function MessageImage({ path, onOpen }: { path: string; onOpen(image: ShownImage): void }) {
  const preview = useImagePreview(path)
  return (
    <li className="message__image" title={path}>
      {preview ? (
        <button
          type="button"
          className="message__image-button"
          aria-label="Open image"
          onClick={() => onOpen({ src: preview, path })}
          onContextMenu={imageContextMenu({ src: preview, path })}
        >
          <img src={preview} alt="" />
        </button>
      ) : (
        <ImageIcon className="icon" />
      )}
    </li>
  )
}

/** Разбивает ленту на сообщения пользователя и ответы на них. */
function buildBlocks(items: readonly TimelineItem[]): Block[] {
  const blocks: Block[] = []
  let turn: Extract<Block, { type: 'turn' }> | null = null
  for (const item of items) {
    if (item.kind === 'user') {
      blocks.push({ type: 'user', item })
      turn = { type: 'turn', key: `${item.id}:turn`, user: item, items: [] }
      blocks.push(turn)
    } else if (turn) {
      turn.items.push(item)
    } else {
      blocks.push({ type: 'entry', item })
    }
  }
  return blocks
}

/**
 * Что из работы агента видно в ленте: его текст, мысли и карточки. Мысли — это пересказ того,
 * что агент сделал и что делает дальше: по ним видно, что он работает, даже когда сам он
 * ничего не пишет. Сами вызовы инструментов не показываются — что агент делает сейчас, видно
 * в строке работы.
 */
function visibleWork(items: readonly TimelineItem[]): TimelineItem[] {
  return items.filter(
    (item) =>
      item.kind !== 'tool' &&
      !((item.kind === 'assistant' || item.kind === 'reasoning') && item.text.trim() === '')
  )
}

interface TurnProps {
  chatId: string
  user: UserItem
  items: readonly TimelineItem[]
  /** Агент ещё отвечает на это сообщение. */
  live: boolean
  /** Ответ только что закончился и ещё не свёрнут: агент может тут же продолжить. */
  unfolded: boolean
  tokens: number
  visible: boolean
}

/**
 * Ответ на сообщение. Пока агент работает, видно всё по порядку: что он пишет и что делает.
 * Законченный ответ — это последний текст агента с временем и копированием, а работа до него
 * свёрнута в «Worked for». Остановленный ответ не сворачивается: всё, что агент успел, остаётся.
 */
function Turn({ chatId, user, items, live, unfolded, tokens, visible }: TurnProps) {
  if (live || unfolded || user.stopped) {
    return (
      <>
        <WorkLog chatId={chatId} items={items} />
        {live ? (
          <WorkingStatus user={user} items={items} tokens={tokens} visible={visible} />
        ) : (
          user.stopped && <StoppedNote user={user} />
        )}
      </>
    )
  }
  const finishedAt = knownFinish(user)
  const finalIndex = items.findLastIndex((item) => item.kind === 'assistant' && item.text !== '')
  const work = items.filter((item, index) => index !== finalIndex && FOLDED_KINDS.has(item.kind))
  return (
    <>
      <WorkSummary
        chatId={chatId}
        duration={finishedAt === undefined ? undefined : finishedAt - user.createdAt}
        items={work}
      />
      {items.map((item, index) =>
        index === finalIndex && item.kind === 'assistant' ? (
          <Markdown key={item.id} text={item.text} preserveLineBreaks={item.commandOutput} />
        ) : FOLDED_KINDS.has(item.kind) ? null : (
          <TimelineEntry key={item.id} chatId={chatId} item={item} />
        )
      )}
    </>
  )
}

/** «Stopped after 40s» под оборванным ответом: агента остановили, дальше он не писал. */
function StoppedNote({ user }: { user: UserItem }) {
  const finishedAt = knownFinish(user)
  return (
    <div className="turn-stopped">
      {finishedAt === undefined
        ? 'Stopped'
        : `Stopped after ${formatDuration(finishedAt - user.createdAt)}`}
    </div>
  )
}

/**
 * Развёрнут ли последний ответ: пока агент работает и ещё `FOLD_DELAY_MS` после. Пауза
 * считается от момента, когда агент перестал работать, и начинается заново, если он снова
 * взялся и снова закончил. Чат, открытый уже после ответа, показывает его сразу свёрнутым.
 */
function useFoldDelay(running: boolean): boolean {
  const [wasRunning, setWasRunning] = useState(running)
  const [stoppedAt, setStoppedAt] = useState<number | null>(null)
  // Состояние меняется прямо при отрисовке, а не в эффекте: иначе на один кадр ответ свернулся бы.
  if (wasRunning !== running) {
    setWasRunning(running)
    setStoppedAt(running ? null : Date.now())
  }
  useEffect(() => {
    if (stoppedAt === null) {
      return
    }
    const timer = setTimeout(() => setStoppedAt(null), FOLD_DELAY_MS)
    return () => clearTimeout(timer)
  }, [stoppedAt])
  return running || stoppedAt !== null
}

/**
 * Когда агент закончил ответ. У прерванного ответа (агента остановили или закрыли Atox) это
 * неизвестно: main ставит время самого сообщения — такой ответ считается без времени.
 */
function knownFinish(user: UserItem): number | undefined {
  return user.finishedAt !== undefined && user.finishedAt > user.createdAt
    ? user.finishedAt
    : undefined
}

/** Работа агента по порядку: его текст и карточки. */
function WorkLog({ chatId, items }: { chatId: string; items: readonly TimelineItem[] }) {
  return visibleWork(items).map((item) => (
    <TimelineEntry key={item.id} chatId={chatId} item={item} />
  ))
}

interface WorkSummaryProps {
  chatId: string
  /** Сколько агент работал над ответом; нет — неизвестно. */
  duration: number | undefined
  items: readonly TimelineItem[]
}

/** «Worked for 1m 50s ›» над ответом: клик раскрывает, что агент делал до него. */
function WorkSummary({ chatId, duration, items }: WorkSummaryProps) {
  const [open, setOpen] = useState(false)
  const label = duration === undefined ? 'Worked' : `Worked for ${formatDuration(duration)}`
  // Агент мог только выполнять команды, ничего не написав: тогда раскрывать нечего.
  const expandable = visibleWork(items).length > 0
  return (
    <div className="work-summary" data-open={open}>
      <button
        type="button"
        className="work-summary__toggle"
        aria-expanded={expandable ? open : undefined}
        disabled={!expandable}
        onClick={() => setOpen((value) => !value)}
      >
        {label}
        {expandable && <ChevronRight className="icon work-summary__chevron" aria-hidden />}
      </button>
      {open && (
        <div className="work-summary__log">
          <WorkLog chatId={chatId} items={items} />
        </div>
      )}
    </div>
  )
}

/** Запись ленты, которую видно как есть: текст агента, ошибка или карточка. */
function TimelineEntry({ chatId, item }: { chatId: string; item: TimelineItem }) {
  switch (item.kind) {
    case 'assistant':
      return <Markdown text={item.text} preserveLineBreaks={item.commandOutput} />
    case 'reasoning':
      return <Markdown text={item.text} />
    case 'error':
      return (
        <div className="message message--error" role="alert">
          <CircleAlert className="icon" />
          <span>{item.message}</span>
        </div>
      )
    case 'approval':
      return <ApprovalCard chatId={chatId} item={item} />
    case 'question':
      return <QuestionCard chatId={chatId} item={item} />
    case 'limits':
      return <LimitsCard limits={item.limits} />
    case 'context':
      return <ContextCard context={item.context} />
    case 'compaction':
      return <CompactionNotice item={item} />
    case 'reconnect':
      return <ReconnectNotice item={item} />
    case 'image':
      return <GeneratedImage item={item} />
    case 'agent-switch':
      return (
        <div className="agent-switch">
          <AgentIcon agent={item.agent} className="agent-switch__icon" />
          Switched to {findAgent(item.agent)?.name ?? item.agent}
        </div>
      )
    case 'user':
    case 'tool':
      return null
  }
}

/** Ход оборвался, и Atox продолжает его сам: тихая строка вместо сырой ошибки. */
function ReconnectNotice({ item }: { item: Extract<TimelineItem, { kind: 'reconnect' }> }) {
  const waiting = item.status === 'offline' || item.status === 'retrying'
  const Icon = waiting ? LoaderCircle : item.status === 'recovered' ? RotateCw : WifiOff
  const text = {
    offline: 'Connection lost. Waiting for the network…',
    retrying: `Connection lost. Reconnecting (attempt ${item.attempt} of ${item.attempts})…`,
    recovered: 'Connection lost. Reconnected and continued',
    failed: 'Connection lost. Couldn’t reconnect',
    stopped: 'Connection lost'
  }[item.status]
  return (
    <div className="reconnect" data-status={item.status} role="status">
      <Icon className={waiting ? 'icon activity__spinner' : 'icon'} aria-hidden />
      <span>{text}</span>
    </div>
  )
}

/** Разделитель в ленте: агент сжимает разговор, всё выше осталось только в сводке. */
function CompactionNotice({ item }: { item: CompactionItem }) {
  return (
    <div className="compaction" data-status={item.status} role="status">
      <span className="compaction__line" />
      <span className="compaction__label">
        {item.status === 'running' ? (
          <LoaderCircle className="icon activity__spinner" />
        ) : item.status === 'failed' ? (
          <CircleAlert className="icon" />
        ) : (
          <FoldVertical className="icon" />
        )}
        <span>{compactionText(item)}</span>
      </span>
      <span className="compaction__line" />
    </div>
  )
}

interface WorkingStatusProps {
  user: UserItem
  /** Что агент уже сделал, отвечая на сообщение: по последнему видно, чем он занят. */
  items: readonly TimelineItem[]
  tokens: number
  visible: boolean
}

/** Строка работающего агента: что он делает сейчас, сколько работает и сколько написал. */
function WorkingStatus({ user, items, tokens, visible }: WorkingStatusProps) {
  const now = useClock(visible)
  const current = items.findLast((item) => item.kind === 'tool' && item.status === 'running')
  const label =
    current?.kind === 'tool'
      ? `${toolVerb(current.tool, true)} ${current.title}`
      : `${workingLabel(items, user.id)}…`
  return (
    <div className="turn-status" data-working role="status">
      <AgentIcon agent={user.agent} className="turn-status__glyph" />
      <span className="turn-status__verb">{label}</span>
      <span className="turn-status__meta">
        ({formatDuration(now - user.createdAt)}
        {tokens > 0 && ` · ↓ ${formatTokens(tokens)} tokens`})
      </span>
    </div>
  )
}

/** Текущее время, которое обновляется каждую секунду, пока `active`. */
function useClock(active: boolean): number {
  const [now, setNow] = useState(Date.now)
  useEffect(() => {
    if (!active) {
      return
    }
    setNow(Date.now())
    const timer = setInterval(() => setNow(Date.now()), CLOCK_INTERVAL_MS)
    return () => clearInterval(timer)
  }, [active])
  return now
}
