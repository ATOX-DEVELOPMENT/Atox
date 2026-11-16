import { readFile } from 'node:fs/promises'
import { join } from 'node:path'
import { CANVAS_PROTOCOL } from '../../shared/canvas'
import {
  CANVAS_ERROR_TOP_INSET,
  CANVAS_KIT_TOKENS,
  CANVAS_TAILWIND_FILE,
  CANVAS_VENDOR_MODULES
} from '../../shared/canvasRuntime'
import type { ScreenBuild } from './build'

/** Адрес общего файла (react, Tailwind) — его отдаёт протокол из папки vendor. */
export const VENDOR_HOST = 'vendor'

function vendorUrl(file: string): string {
  return `${CANVAS_PROTOCOL}://${VENDOR_HOST}/${file}`
}

const IMPORT_MAP = JSON.stringify({
  imports: Object.fromEntries(
    Object.entries(CANVAS_VENDOR_MODULES).map(([name, file]) => [name, vendorUrl(file)])
  )
})

/** Экран заполняет кадр устройства без полос прокрутки; шрифт — системный. */
const BASE_STYLE = `html, body { margin: 0; height: 100%; overflow: hidden; }
body {
  font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, "Helvetica Neue", Arial, sans-serif;
  -webkit-font-smoothing: antialiased;
}
#root { height: 100%; }`

/** Текст внутри `<script>` и `<style>` не должен закрыть свой тег раньше времени. */
function inlineSafe(text: string, tag: 'script' | 'style'): string {
  return text.replace(new RegExp(`</(${tag})`, 'gi'), '<\\/$1')
}

function escapeHtml(text: string): string {
  return text.replace(/[&<>"]/g, (char) => `&#${char.charCodeAt(0)};`)
}

/** Токены кита; без них экран остаётся со стандартной темой Tailwind. */
async function readTokens(kitDirectory: string): Promise<string> {
  try {
    return await readFile(join(kitDirectory, CANVAS_KIT_TOKENS), 'utf-8')
  } catch (error) {
    console.error('Failed to read the canvas kit tokens', error)
    return ''
  }
}

/**
 * Страница экрана-React: корень `#root`, import map на общие файлы, Tailwind с темой кита
 * и сам экран одним модулем. Компонент рисуется внутри границы ошибок — упавший экран
 * показывает карточку с ошибкой, а не пустоту.
 */
export async function renderShell(build: ScreenBuild, kitDirectory: string): Promise<string> {
  const theme = await readTokens(kitDirectory)
  return `<!doctype html>
<html lang="en">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<style>${BASE_STYLE}</style>
<script type="importmap">${IMPORT_MAP}</script>
<script src="${vendorUrl(CANVAS_TAILWIND_FILE)}"></script>
<style type="text/tailwindcss">${inlineSafe(`${theme}\n${build.css}`, 'style')}</style>
</head>
<body>
<div id="root"></div>
<script type="module">${inlineSafe(build.js, 'script')}</script>
</body>
</html>
`
}

/** Страница вместо экрана, который не удалось собрать ни разу: показывает причину. */
export function renderBuildErrorPage(message: string): string {
  return `<!doctype html>
<html lang="en">
<head>
<meta charset="utf-8">
<style>${BASE_STYLE}
.error { box-sizing: border-box; height: 100%; padding: ${CANVAS_ERROR_TOP_INSET}px 24px 24px; overflow: auto; background: #fef2f2; color: #7f1d1d; font: 14px/1.5 ui-monospace, Menlo, monospace; }
.error strong { display: block; margin-bottom: 8px; font-size: 16px; }
.error div { white-space: pre-wrap; }
</style>
</head>
<body>
<div class="error"><strong>This screen could not be built</strong><div>${escapeHtml(message)}</div></div>
</body>
</html>
`
}
