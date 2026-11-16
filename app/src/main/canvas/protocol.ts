import { protocol } from 'electron'
import { CANVAS_PROTOCOL } from '../../shared/canvas'
import { screenContentSecurityPolicy } from './rules'

const NOT_FOUND = 404
const METHOD_NOT_ALLOWED = 405

/** Адрес экрана: `atox-canvas://screen/<холст>/<экран>?r=<ревизия>[&v=<версия>]`. */
const SCREEN_HOST = 'screen'

export interface ScreenDocumentSource {
  /** HTML экрана или его версии; `null` — такого экрана или версии нет. */
  screenDocument(canvasId: string, screenId: string, versionId?: string): Promise<string | null>
}

/**
 * Схема экранов; объявляется до готовности приложения. `standard` разбирает адрес на хост
 * и путь, `secure` позволяет встраивать экран в окно приложения без предупреждений
 * о смешанном содержимом. Доступа к fetch и CORS у экранов нет.
 */
export const CANVAS_SCHEME: Electron.CustomScheme = {
  scheme: CANVAS_PROTOCOL,
  privileges: { standard: true, secure: true }
}

/**
 * Отдаёт HTML экранов холста. Адрес называет холст и экран по id, а не путь: файлы, которых
 * нет на холсте, по этой схеме не прочитать. Страница идёт со строгой политикой
 * безопасности — без сети и без доступа к приложению; встроить её может только окно
 * приложения с источником `appOrigin`.
 */
export function handleCanvasProtocol(source: ScreenDocumentSource, appOrigin: string): void {
  const headers = {
    'Content-Type': 'text/html; charset=utf-8',
    'Content-Security-Policy': screenContentSecurityPolicy(appOrigin),
    'X-Content-Type-Options': 'nosniff',
    'Cache-Control': 'no-store'
  }
  protocol.handle(CANVAS_PROTOCOL, async (request) => {
    if (request.method !== 'GET') {
      return new Response(null, { status: METHOD_NOT_ALLOWED })
    }
    const url = new URL(request.url)
    const [canvasId, screenId, ...rest] = url.pathname.split('/').filter(Boolean)
    if (url.hostname !== SCREEN_HOST || !canvasId || !screenId || rest.length > 0) {
      return new Response(null, { status: NOT_FOUND })
    }
    const versionId = url.searchParams.get('v') ?? undefined
    const document = await source
      .screenDocument(canvasId, screenId, versionId)
      .catch((error: unknown) => {
        console.error('Failed to read a canvas screen', error)
        return null
      })
    if (document === null) {
      return new Response(null, { status: NOT_FOUND })
    }
    return new Response(document, { headers })
  })
}
