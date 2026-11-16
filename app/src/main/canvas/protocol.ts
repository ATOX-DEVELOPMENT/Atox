import { readFile } from 'node:fs/promises'
import { join } from 'node:path'
import { protocol } from 'electron'
import { CANVAS_PROTOCOL } from '../../shared/canvas'
import { screenContentSecurityPolicy } from './rules'
import { VENDOR_HOST } from './shell'

const NOT_FOUND = 404
const METHOD_NOT_ALLOWED = 405

/** Адрес экрана: `atox-canvas://screen/<холст>/<экран>?r=<ревизия>[&v=<версия>]`. */
const SCREEN_HOST = 'screen'

/** Файлы vendor — только имена из папки без путей: `react.js`, `chunk-ABC.js`. */
const VENDOR_FILE = /^[\w-]+(\.[\w-]+)*\.js$/

export interface ScreenDocument {
  html: string
  /** Страница подключает скрипты общих файлов: ей нужна более широкая политика безопасности. */
  modules: boolean
}

export interface ScreenDocumentSource {
  /** Страница экрана или его версии; `null` — такого экрана или версии нет. */
  screenDocument(
    canvasId: string,
    screenId: string,
    versionId?: string
  ): Promise<ScreenDocument | null>
}

/**
 * Схема экранов; объявляется до готовности приложения. `standard` разбирает адрес на хост
 * и путь, `secure` позволяет встраивать экран в окно приложения без предупреждений
 * о смешанном содержимом, `corsEnabled` — подключать общие модули из страницы без
 * источника (iframe без allow-same-origin). Доступа к fetch у экранов нет.
 */
export const CANVAS_SCHEME: Electron.CustomScheme = {
  scheme: CANVAS_PROTOCOL,
  privileges: { standard: true, secure: true, corsEnabled: true }
}

/**
 * Отдаёт экраны холста и общие файлы к ним. Адрес называет холст и экран по id, а не путь:
 * файлы, которых нет на холсте, по этой схеме не прочитать. Страница идёт со строгой
 * политикой безопасности — без сети и без доступа к приложению; встроить её может только
 * окно приложения с источником `appOrigin`. Общие файлы (react, Tailwind) отдаются
 * из `vendorDirectory` по имени.
 */
export function handleCanvasProtocol(
  source: ScreenDocumentSource,
  appOrigin: string,
  vendorDirectory: string
): void {
  const common = { 'X-Content-Type-Options': 'nosniff', 'Cache-Control': 'no-store' }
  const pageHeaders = (modules: boolean) => ({
    ...common,
    'Content-Type': 'text/html; charset=utf-8',
    'Content-Security-Policy': screenContentSecurityPolicy(appOrigin, modules)
  })
  const vendorHeaders = {
    ...common,
    'Content-Type': 'text/javascript; charset=utf-8',
    'Access-Control-Allow-Origin': '*'
  }
  protocol.handle(CANVAS_PROTOCOL, async (request) => {
    if (request.method !== 'GET') {
      return new Response(null, { status: METHOD_NOT_ALLOWED })
    }
    const url = new URL(request.url)
    const [first, second, ...rest] = url.pathname.split('/').filter(Boolean)
    if (url.hostname === VENDOR_HOST && first && !second && VENDOR_FILE.test(first)) {
      const file = await readFile(join(vendorDirectory, first)).catch(() => null)
      return file
        ? new Response(file, { headers: vendorHeaders })
        : new Response(null, { status: NOT_FOUND })
    }
    if (url.hostname !== SCREEN_HOST || !first || !second || rest.length > 0) {
      return new Response(null, { status: NOT_FOUND })
    }
    const versionId = url.searchParams.get('v') ?? undefined
    const document = await source
      .screenDocument(first, second, versionId)
      .catch((error: unknown) => {
        console.error('Failed to read a canvas screen', error)
        return null
      })
    if (document === null) {
      return new Response(null, { status: NOT_FOUND })
    }
    return new Response(document.html, { headers: pageHeaders(document.modules) })
  })
}
