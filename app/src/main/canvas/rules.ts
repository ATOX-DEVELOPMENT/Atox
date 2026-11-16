import { extname, isAbsolute, relative, sep } from 'node:path'
import {
  CANVAS_NAME_MAX_LENGTH,
  SCREEN_DEVICES,
  SCREEN_GAP,
  SCREEN_SIZE,
  type CanvasScreen,
  type ScreenDevice
} from '../../shared/canvas'

/**
 * Правила холста, которые не зависят от Electron и диска: раскладка новых экранов, имена,
 * размеры, тексты сообщений агенту. Сервис холстов и команда `atox canvas` опираются на них.
 */

/** Ошибка, понятная человеку и агенту: её текст показывается как есть. */
export class CanvasError extends Error {}

/** Правее этой границы новый экран не ставится, а переносится в новый ряд. */
export const CANVAS_ROW_WIDTH = 3600

/** Экран — один лёгкий HTML-файл; больший файл не читается и не сохраняется в историю. */
export const SCREEN_FILE_MAX_MB = 2
export const SCREEN_FILE_MAX_BYTES = SCREEN_FILE_MAX_MB * 1024 * 1024

const SCREEN_FILE_EXTENSIONS = new Set(['.html', '.htm'])

/** Начало сообщений холста: по нему агент (и навык `atox-canvas`) узнаёт их. */
export const CANVAS_MESSAGE_PREFIX = '[Atox canvas]'

/** Имя холста, когда у чата нет названия. */
export const DEFAULT_CANVAS_NAME = 'Canvas'

export interface ScreenPlacement {
  x: number
  y: number
}

/**
 * Где встанет новый экран: правее самого правого, по верхнему краю его ряда. Если так он
 * вышел бы за `CANVAS_ROW_WIDTH`, — в новый ряд под всеми экранами, от левого края.
 */
export function placeNewScreen(
  screens: readonly Pick<CanvasScreen, 'x' | 'y' | 'width' | 'height'>[],
  width: number
): ScreenPlacement {
  if (screens.length === 0) {
    return { x: 0, y: 0 }
  }
  const rightmost = screens.reduce((best, screen) =>
    screen.x + screen.width > best.x + best.width ? screen : best
  )
  const x = rightmost.x + rightmost.width + SCREEN_GAP
  if (x + width <= CANVAS_ROW_WIDTH) {
    return { x, y: rightmost.y }
  }
  return {
    x: Math.min(...screens.map((screen) => screen.x)),
    y: Math.max(...screens.map((screen) => screen.y + screen.height)) + SCREEN_GAP
  }
}

/** Экран по имени: агент называет его как угодно по регистру и с пробелами по краям. */
export function findScreenByName<Screen extends Pick<CanvasScreen, 'name'>>(
  screens: readonly Screen[],
  name: string
): Screen | undefined {
  const wanted = name.trim().toLowerCase()
  return screens.find((screen) => screen.name.toLowerCase() === wanted)
}

/** Имя холста или экрана без пробелов по краям; пустое или слишком длинное — ошибка. */
export function parseName(value: unknown, subject: string): string {
  const name = typeof value === 'string' ? value.trim() : ''
  if (!name) {
    throw new CanvasError(`The ${subject} name is empty.`)
  }
  if (name.length > CANVAS_NAME_MAX_LENGTH) {
    throw new CanvasError(
      `The ${subject} name is longer than ${CANVAS_NAME_MAX_LENGTH} characters.`
    )
  }
  return name
}

/** Имя холста из названия чата: обрезается до допустимой длины, пустое — имя по умолчанию. */
export function canvasNameFromTitle(title: string): string {
  return title.trim().slice(0, CANVAS_NAME_MAX_LENGTH).trim() || DEFAULT_CANVAS_NAME
}

/** Размер `WxH` из команды агента. */
export function parseScreenSize(value: string): { width: number; height: number } {
  const match = /^\s*(\d+)\s*[xX×]\s*(\d+)\s*$/.exec(value)
  const width = Number(match?.[1])
  const height = Number(match?.[2])
  if (!match || !isScreenDimension(width) || !isScreenDimension(height)) {
    throw new CanvasError(
      `Invalid size "${value}". Use WIDTHxHEIGHT in pixels, each from ${SCREEN_SIZE.min} to ${SCREEN_SIZE.max}, for example 390x844.`
    )
  }
  return { width, height }
}

export function isScreenDimension(value: unknown): value is number {
  return (
    typeof value === 'number' &&
    Number.isInteger(value) &&
    value >= SCREEN_SIZE.min &&
    value <= SCREEN_SIZE.max
  )
}

/** Название устройства для человека и агента: «iPhone», «Custom». */
export function deviceName(device: ScreenDevice): string {
  return device === 'custom' ? 'Custom' : SCREEN_DEVICES[device].name
}

export function isScreenFileName(path: string): boolean {
  return SCREEN_FILE_EXTENSIONS.has(extname(path).toLowerCase())
}

/** Путь лежит в папке или совпадает с ней; оба пути — абсолютные и без символических ссылок. */
export function isInsideFolder(path: string, folder: string): boolean {
  const relation = relative(folder, path)
  const outside = relation === '..' || relation.startsWith(`..${sep}`) || isAbsolute(relation)
  return !outside
}

/**
 * Добавляет версию в конец истории и вытесняет самые старые сверх предела. Возвращает новую
 * историю и вытесненные версии — их снимки больше не нужны, если на них не ссылаются другие.
 */
export function appendVersion<Version>(
  versions: readonly Version[],
  version: Version,
  limit: number
): { versions: Version[]; dropped: Version[] } {
  const all = [...versions, version]
  const overflow = Math.max(0, all.length - limit)
  return { versions: all.slice(overflow), dropped: all.slice(0, overflow) }
}

/** Допуск измерения: скроллбар или округление не считаются выходом за экран. */
const OVERFLOW_TOLERANCE_PX = 1

/**
 * Что не так с раскладкой экрана, словами, по которым агент может поправить HTML. Пусто —
 * всё помещается. Если окно измерения не совпало с экраном (его ужали), измерение
 * недостоверно, и о раскладке молчим.
 */
export function describeOverflow(
  screen: { width: number; height: number },
  size: {
    contentWidth: number
    contentHeight: number
    viewportWidth: number
    viewportHeight: number
  } | null
): string[] {
  if (
    !size ||
    Math.abs(size.viewportWidth - screen.width) > OVERFLOW_TOLERANCE_PX ||
    Math.abs(size.viewportHeight - screen.height) > OVERFLOW_TOLERANCE_PX
  ) {
    return []
  }
  const problems: string[] = []
  if (size.contentHeight > screen.height + OVERFLOW_TOLERANCE_PX) {
    problems.push(
      `Content is ${size.contentHeight} px tall but the screen is ${screen.height} px: it is cut off.`
    )
  }
  if (size.contentWidth > screen.width + OVERFLOW_TOLERANCE_PX) {
    problems.push(
      `Content is wider than the screen (${size.contentWidth} > ${screen.width} px).`
    )
  }
  return problems
}

export interface FixMessage {
  screenName: string
  canvasName: string
  text: string
  file: string
  /** Скриншот экрана; `null` — снять не удалось, строки в сообщении не будет. */
  screenshot: string | null
}

/** Просьба человека поправить экран. Формат знает навык `atox-canvas`: менять его вместе. */
export function formatFixMessage({
  screenName,
  canvasName,
  text,
  file,
  screenshot
}: FixMessage): string {
  const lines = [
    `${CANVAS_MESSAGE_PREFIX} Fix the screen "${screenName}" on the canvas "${canvasName}":`,
    text.trim(),
    '',
    `File: ${file}`,
    ...(screenshot ? [`Screenshot: ${screenshot}`] : [])
  ]
  return lines.join('\n')
}

/** Просьба человека с холста, не про один экран. */
export function formatCanvasMessage(text: string): string {
  return `${CANVAS_MESSAGE_PREFIX} ${text.trim()}`
}

/**
 * Политика безопасности страницы экрана: только встроенные стили и скрипты, картинки
 * и шрифты из data:, никакой сети, форм и смены адреса. Встраивать страницу может только окно
 * приложения (`frameAncestor`).
 */
export function screenContentSecurityPolicy(frameAncestor: string): string {
  return [
    "default-src 'none'",
    "script-src 'unsafe-inline'",
    "style-src 'unsafe-inline'",
    'img-src data: blob:',
    'font-src data:',
    'media-src data:',
    "connect-src 'none'",
    "form-action 'none'",
    "base-uri 'none'",
    `frame-ancestors ${frameAncestor}`
  ].join('; ')
}
