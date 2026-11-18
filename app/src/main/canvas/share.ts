import { createHash, randomBytes } from 'node:crypto'
import { promisify } from 'node:util'
import { gzip } from 'node:zlib'
import type { CanvasGroup, CanvasLink, ScreenFrame } from '../../shared/canvas'
import { CanvasError } from './rules'

const gzipAsync = promisify(gzip)

/**
 * Сайт, где открываются ссылки «Share»: служба хранит снимок холста и показывает его
 * в браузере, в том числе на телефоне. Для разработки адрес меняется переменной окружения.
 */
export const SHARE_ORIGIN = (process.env['ATOX_SHARE_ORIGIN'] ?? 'https://share.atox.dev').replace(
  /\/+$/,
  ''
)

/** Сколько ждать ответа службы: публикация несёт страницы всех экранов. */
const REQUEST_TIMEOUT_MS = 120_000

/** Секрет и адрес публикации: по секрету холст обновляет и закрывает свою ссылку. */
export interface ShareCredentials {
  id: string
  token: string
}

/** Страница холста в том виде, в каком её показывает страница просмотра: без путей к файлам и истории. */
export interface SharedPage {
  id: string
  name: string
  screens: {
    id: string
    name: string
    device: string
    frame: ScreenFrame
    width: number
    height: number
    x: number
    y: number
    revision: number
  }[]
  groups: CanvasGroup[]
  links: Pick<CanvasLink, 'id' | 'from' | 'to' | 'anchor'>[]
}

/** Холст чата для страницы просмотра: страницы по порядку; id экранов разные во всём холсте. */
export interface SharedCanvas {
  name: string
  pages: SharedPage[]
}

export function shareUrl(id: string): string {
  return `${SHARE_ORIGIN}/${id}`
}

export function newShareCredentials(): ShareCredentials {
  // Адрес — единственное, что защищает ссылку, поэтому он длинный и случайный.
  return { id: randomBytes(18).toString('base64url'), token: randomBytes(32).toString('base64url') }
}

/** Экран на сайте: статичная страница (без скриптов экрана), её стили и картинка для обзора. */
export interface SharedScreenPage {
  html: string
  css: string
  thumbnail: Buffer | null
}

/**
 * Восстанавливает прокрутку, которой нет в разметке: снимок помечает прокрученные блоки.
 * Других скриптов в странице экрана на сайте нет.
 */
const RESTORE_SCROLL_SCRIPT = `<script>addEventListener('load',()=>{for(const e of document.querySelectorAll('[data-share-scroll]')){const[t,l]=e.dataset.shareScroll.split(',');e.scrollTop=+t;e.scrollLeft=+l}})</script>`

/**
 * Страницы экранов для службы. Одинаковые стили (у экранов одного проекта они обычно общие)
 * уходят один раз: страница подключает их по хешу, и браузер берёт их из кэша.
 */
export function sharedPages(screens: ReadonlyMap<string, SharedScreenPage>): {
  docs: Record<string, string>
  thumbs: Record<string, string>
  styles: Record<string, string>
} {
  const docs: Record<string, string> = {}
  const thumbs: Record<string, string> = {}
  const styles: Record<string, string> = {}
  for (const [id, { html, css, thumbnail }] of screens) {
    const hash = createHash('sha256').update(css).digest('hex')
    styles[hash] = css
    const head = `<link rel="stylesheet" href="/c/${hash}.css">${RESTORE_SCROLL_SCRIPT}`
    docs[id] = html.includes('</head>') ? html.replace('</head>', `${head}</head>`) : head + html
    if (thumbnail) {
      thumbs[id] = thumbnail.toString('base64')
    }
  }
  return { docs, thumbs, styles }
}

interface PublishRequest {
  canvas: SharedCanvas
  screens: ReadonlyMap<string, SharedScreenPage>
}

async function call(
  method: 'PUT' | 'DELETE',
  { id, token }: ShareCredentials,
  body?: Buffer
): Promise<Response> {
  try {
    return await fetch(`${SHARE_ORIGIN}/api/shares/${id}`, {
      method,
      headers: {
        Authorization: `Bearer ${token}`,
        ...(body && { 'Content-Type': 'application/json', 'Content-Encoding': 'gzip' })
      },
      ...(body && { body: new Uint8Array(body) }),
      signal: AbortSignal.timeout(REQUEST_TIMEOUT_MS)
    })
  } catch (error) {
    console.error('The sharing service is unreachable', error)
    throw new CanvasError(
      'Could not reach the sharing service. Check the connection and try again.'
    )
  }
}

async function failure(response: Response): Promise<CanvasError> {
  const detail = await response
    .json()
    .then((value) => {
      const { error } = value as { error?: unknown }
      return typeof error === 'string' ? error : null
    })
    .catch(() => null)
  return new CanvasError(
    detail ?? `The sharing service answered with an error (${response.status}).`
  )
}

/** Публикует холст по ссылке: снимки экранов всех страниц, их места, группы и линии. */
export async function publishShare(
  credentials: ShareCredentials,
  { canvas, screens }: PublishRequest
): Promise<void> {
  const payload = JSON.stringify({ canvas, ...sharedPages(screens) })
  const response = await call('PUT', credentials, await gzipAsync(Buffer.from(payload)))
  if (!response.ok) {
    throw await failure(response)
  }
}

/** Закрывает ссылку: страница по ней больше не открывается. Уже закрытая — не ошибка. */
export async function unpublishShare(credentials: ShareCredentials): Promise<void> {
  const response = await call('DELETE', credentials)
  if (!response.ok && response.status !== 404) {
    throw await failure(response)
  }
}
