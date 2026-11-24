import { Readable } from 'node:stream'
import { net, type IncomingMessage } from 'electron'

export interface HttpRequestInit {
  method?: string
  headers?: Record<string, string>
  body?: string
  signal?: AbortSignal
  cache?: 'default' | 'no-store'
}

/** Коды, которые может нести `Response`; остальное подставляют прокси и антивирусы. */
const MIN_RESPONSE_STATUS = 200
const MAX_RESPONSE_STATUS = 599
/** Ответы без тела. */
const NULL_BODY_STATUSES = new Set([204, 205, 304])

/** Ответ с кодом, которого не бывает в HTTP: запрос считается неудачным, а не упавшим. */
export class InvalidResponseStatusError extends Error {
  constructor(readonly status: number) {
    super(`Server responded with an invalid HTTP status ${status}`)
    this.name = 'InvalidResponseStatusError'
  }
}

/**
 * Запрос через сеть Chromium — с системным прокси и сертификатами, как `net.fetch`. `net.fetch`
 * не годится: на код ответа вне 200–599 (его подставляют прокси и антивирусы, чаще на Windows)
 * он бросает исключение, которое роняет главный процесс, а его промис не завершается никогда.
 * Здесь такой ответ — обычная ошибка запроса. Куки не отправляются.
 */
export function httpRequest(url: string, init: HttpRequestInit = {}): Promise<Response> {
  const { signal } = init
  const method = init.method ?? 'GET'
  return new Promise((resolve, reject) => {
    if (signal?.aborted) {
      reject(signal.reason)
      return
    }
    const request = net.request({
      url,
      method,
      cache: init.cache ?? 'default',
      credentials: 'omit',
      redirect: 'follow'
    })
    let response: IncomingMessage | undefined
    const onAbort = (): void => {
      request.abort()
      // Тело уже читается: обрыв должен дойти до читающего, иначе он ждёт вечно.
      ;(response as unknown as Readable | undefined)?.destroy(signal?.reason)
      reject(signal?.reason)
    }
    signal?.addEventListener('abort', onAbort, { once: true })
    const finish = (): void => signal?.removeEventListener('abort', onAbort)

    request.on('response', (incoming) => {
      response = incoming
      const status = incoming.statusCode
      if (!Number.isInteger(status) || status < MIN_RESPONSE_STATUS || status > MAX_RESPONSE_STATUS) {
        finish()
        request.abort()
        reject(new InvalidResponseStatusError(status))
        return
      }
      const stream = incoming as unknown as Readable
      const headers = new Headers()
      for (const [name, value] of Object.entries(incoming.headers)) {
        headers.set(name, Array.isArray(value) ? value.join(', ') : value)
      }
      let body: ReadableStream<Uint8Array> | null = null
      if (NULL_BODY_STATUSES.has(status) || method === 'HEAD') {
        stream.resume()
        finish()
      } else {
        stream.once('end', finish)
        stream.once('error', finish)
        body = Readable.toWeb(stream) as ReadableStream<Uint8Array>
      }
      resolve(new Response(body, { status, statusText: incoming.statusMessage, headers }))
    })
    request.on('error', (error) => {
      finish()
      reject(error)
    })
    for (const [name, value] of Object.entries(init.headers ?? {})) {
      request.setHeader(name, value)
    }
    request.end(init.body)
  })
}
