import { createHash, randomBytes } from 'node:crypto'
import { readFile, readdir } from 'node:fs/promises'
import { join } from 'node:path'
import { promisify } from 'node:util'
import { gzip } from 'node:zlib'
import {
  CANVAS_PROTOCOL,
  type CanvasGroup,
  type CanvasLink,
  type ScreenFrame
} from '../../shared/canvas'
import { CanvasError } from './rules'
import { VENDOR_HOST } from './shell'

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

/** Холст в том виде, в каком его показывает страница просмотра: без путей к файлам и истории. */
export interface SharedCanvas {
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

export interface VendorBundle {
  /** Хеш всех общих файлов: по нему служба понимает, что они у неё уже есть. */
  hash: string
  files: ReadonlyMap<string, Buffer>
}

export function shareUrl(id: string): string {
  return `${SHARE_ORIGIN}/${id}`
}

export function newShareCredentials(): ShareCredentials {
  // Адрес — единственное, что защищает ссылку, поэтому он длинный и случайный.
  return { id: randomBytes(18).toString('base64url'), token: randomBytes(32).toString('base64url') }
}

/** Общие файлы экранов (react, Tailwind): страницы на сайте берут их по хешу, а не из приложения. */
export async function readVendorBundle(directory: string): Promise<VendorBundle> {
  const names = (await readdir(directory)).filter((name) => name.endsWith('.js')).toSorted()
  const files = new Map<string, Buffer>()
  const hash = createHash('sha256')
  for (const name of names) {
    const content = await readFile(join(directory, name))
    files.set(name, content)
    hash.update(`${name}\0${content.length}\0`).update(content)
  }
  if (files.size === 0) {
    throw new CanvasError('The canvas files for sharing are missing from this build of Atox.')
  }
  return { hash: hash.digest('hex'), files }
}

const VENDOR_URL_PREFIX = `${CANVAS_PROTOCOL}://${VENDOR_HOST}/`

/** Страница экрана для сайта: общие файлы лежат по адресу службы, а не в приложении. */
export function pageForSharing(html: string, vendorHash: string): string {
  return html.replaceAll(VENDOR_URL_PREFIX, `/v/${vendorHash}/`)
}

interface PublishRequest {
  canvas: SharedCanvas
  docs: Record<string, string>
  vendor: VendorBundle
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

/**
 * Публикует холст по ссылке. Общие файлы идут, только если службе их не хватает: она
 * отвечает «vendor-missing» — тогда запрос повторяется вместе с ними.
 */
export async function publishShare(
  credentials: ShareCredentials,
  { canvas, docs, vendor }: PublishRequest
): Promise<void> {
  const send = async (withVendor: boolean): Promise<Response> => {
    const payload = {
      canvas,
      docs,
      ...(withVendor
        ? {
            vendor: {
              hash: vendor.hash,
              files: Object.fromEntries(
                [...vendor.files].map(([name, content]) => [name, content.toString('base64')])
              )
            }
          }
        : { vendorHash: vendor.hash })
    }
    return call('PUT', credentials, await gzipAsync(Buffer.from(JSON.stringify(payload))))
  }
  let response = await send(false)
  if (response.status === 409) {
    response = await send(true)
  }
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
