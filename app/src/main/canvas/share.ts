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

/** Сколько ждать ответа службы на один запрос: крупные файлы идут отдельными запросами. */
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

/** Файл холста на сайте: картинка, шрифт или стили, по хешу содержимого. */
export interface SharedAsset {
  hash: string
  type: string
  data: Buffer
}

/** Встроенные в страницу файлы меньше этого остаются в ней: отдельный запрос дороже. */
const ASSET_MIN_BYTES = 2048

/** Какие встроенные файлы служба принимает отдельно; то же правило в share/server.js. */
const ASSET_TYPES =
  /^(image\/(png|jpeg|gif|webp|avif|svg\+xml)|font\/[\w.+-]+|application\/(x-)?font-[\w.+-]+|application\/vnd\.ms-fontobject|text\/css)$/

/** Встроенный файл `data:<тип>;base64,<данные>` — в HTML-атрибуте или в `url()` стилей. */
const DATA_URI = /data:([a-z]+\/[a-z0-9.+-]+)((?:;[a-z0-9-]+=[^;,"')\s]+)*);base64,([A-Za-z0-9+/]+={0,2})/gi

function sha256(data: string | Buffer): string {
  return createHash('sha256').update(data).digest('hex')
}

function addAsset(assets: Map<string, SharedAsset>, type: string, data: Buffer): string {
  const hash = sha256(data)
  if (!assets.has(hash)) {
    assets.set(hash, { hash, type, data })
  }
  return `/a/${hash}`
}

/**
 * Выносит крупные встроенные файлы (фото, шрифты) из текста страницы или стилей в отдельные
 * файлы: в тексте остаётся ссылка на них. Одинаковый файл на разных экранах уходит один раз,
 * а уже лежащий на сайте — не уходит вовсе.
 */
function extractAssets(text: string, assets: Map<string, SharedAsset>): string {
  return text.replace(DATA_URI, (whole, rawType: string, _parameters: string, base64: string) => {
    const type = rawType.toLowerCase()
    if (!ASSET_TYPES.test(type) || base64.length * 0.75 < ASSET_MIN_BYTES) {
      return whole
    }
    return addAsset(assets, type, Buffer.from(base64, 'base64'))
  })
}

/**
 * Страницы экранов для службы. Стили и крупные встроенные файлы уходят отдельными файлами по
 * хешу: у экранов одного проекта они обычно общие, и повторная публикация их не шлёт.
 */
export function sharedPages(screens: ReadonlyMap<string, SharedScreenPage>): {
  docs: Record<string, string>
  thumbs: Record<string, string>
  assets: Map<string, SharedAsset>
} {
  const docs: Record<string, string> = {}
  const thumbs: Record<string, string> = {}
  const assets = new Map<string, SharedAsset>()
  for (const [id, { html, css, thumbnail }] of screens) {
    const stylesheet = addAsset(assets, 'text/css', Buffer.from(extractAssets(css, assets)))
    const head = `<link rel="stylesheet" href="${stylesheet}">${RESTORE_SCROLL_SCRIPT}`
    const page = extractAssets(html, assets)
    docs[id] = page.includes('</head>') ? page.replace('</head>', `${head}</head>`) : head + page
    if (thumbnail) {
      thumbs[id] = thumbnail.toString('base64')
    }
  }
  return { docs, thumbs, assets }
}

interface PublishRequest {
  canvas: SharedCanvas
  screens: ReadonlyMap<string, SharedScreenPage>
}

/** Сколько файлов холста грузится одновременно и сколько попыток у каждого. */
const ASSET_CONCURRENCY = 4
const ASSET_ATTEMPTS = 3
/** Пауза перед повтором после сбоя сети, мс. */
const RETRY_DELAY_MS = 1500

async function request(path: string, init: RequestInit): Promise<Response> {
  try {
    return await fetch(`${SHARE_ORIGIN}${path}`, {
      ...init,
      signal: AbortSignal.timeout(REQUEST_TIMEOUT_MS)
    })
  } catch (error) {
    console.error('The sharing service is unreachable', error)
    throw new CanvasError(
      'Could not reach the sharing service. Check the connection and try again.'
    )
  }
}

/** Запрос, который при сбое сети или ответе 5xx повторяется: загрузка файла безопасна для повтора. */
async function requestWithRetry(path: string, init: () => RequestInit): Promise<Response> {
  for (let attempt = 1; ; attempt += 1) {
    try {
      const response = await request(path, init())
      if (response.status < 500 || attempt >= ASSET_ATTEMPTS) {
        return response
      }
    } catch (error) {
      if (attempt >= ASSET_ATTEMPTS) {
        throw error
      }
    }
    await new Promise((resolve) => setTimeout(resolve, RETRY_DELAY_MS * attempt))
  }
}

function auth({ token }: ShareCredentials): Record<string, string> {
  return { Authorization: `Bearer ${token}` }
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

async function gzipJson(value: unknown): Promise<Uint8Array> {
  return new Uint8Array(await gzipAsync(Buffer.from(JSON.stringify(value))))
}

/** Каких файлов из списка у службы ещё нет. */
async function missingAssets(credentials: ShareCredentials, hashes: string[]): Promise<string[]> {
  const body = await gzipJson({ hashes })
  const response = await requestWithRetry('/api/assets/missing', () => ({
    method: 'POST',
    headers: {
      ...auth(credentials),
      'Content-Type': 'application/json',
      'Content-Encoding': 'gzip'
    },
    body
  }))
  if (!response.ok) {
    throw await failure(response)
  }
  const { missing } = (await response.json()) as { missing?: unknown }
  return Array.isArray(missing) ? missing.filter((hash) => typeof hash === 'string') : hashes
}

/** Загружает файлы по нескольку сразу; каждый — своим запросом, с повтором при сбое сети. */
async function uploadAssets(
  credentials: ShareCredentials,
  assets: readonly SharedAsset[]
): Promise<void> {
  const queue = [...assets]
  const worker = async () => {
    for (let asset = queue.shift(); asset; asset = queue.shift()) {
      const { hash, type, data } = asset
      const response = await requestWithRetry(`/api/assets/${hash}`, () => ({
        method: 'PUT',
        headers: { ...auth(credentials), 'Content-Type': type },
        body: new Uint8Array(data)
      }))
      if (!response.ok) {
        throw await failure(response)
      }
    }
  }
  await Promise.all(Array.from({ length: ASSET_CONCURRENCY }, worker))
}

/**
 * Публикует холст по ссылке: сначала файлы, которых у службы ещё нет (стили, фото, шрифты), потом
 * сам холст — экраны, их места, группы и линии. Холст лёгкий, поэтому его запрос не упирается
 * в медленную сеть; файлы грузятся по одному и повторяются при сбое.
 */
export async function publishShare(
  credentials: ShareCredentials,
  { canvas, screens }: PublishRequest
): Promise<void> {
  const { docs, thumbs, assets } = sharedPages(screens)
  const hashes = [...assets.keys()]
  const missing = await missingAssets(credentials, hashes)
  await uploadAssets(
    credentials,
    missing.flatMap((hash) => assets.get(hash) ?? [])
  )
  const body = await gzipJson({ canvas, docs, thumbs, styles: {}, assets: hashes })
  const publish = () =>
    request(`/api/shares/${credentials.id}`, {
      method: 'PUT',
      headers: {
        ...auth(credentials),
        'Content-Type': 'application/json',
        'Content-Encoding': 'gzip'
      },
      body
    })
  let response = await publish()
  // Файл могли удалить между проверкой и публикацией: служба называет недостающие.
  if (response.status === 409) {
    const { missing: lost } = (await response.json().catch(() => ({}))) as { missing?: unknown }
    const again = Array.isArray(lost) ? lost.flatMap((hash) => assets.get(String(hash)) ?? []) : []
    await uploadAssets(credentials, again)
    response = await publish()
  }
  if (!response.ok) {
    throw await failure(response)
  }
}

/** Закрывает ссылку: страница по ней больше не открывается. Уже закрытая — не ошибка. */
export async function unpublishShare(credentials: ShareCredentials): Promise<void> {
  const response = await request(`/api/shares/${credentials.id}`, {
    method: 'DELETE',
    headers: auth(credentials)
  })
  if (!response.ok && response.status !== 404) {
    throw await failure(response)
  }
}
