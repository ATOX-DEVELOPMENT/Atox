import { randomUUID } from 'node:crypto'
import { mkdir, readdir, rm, stat, writeFile } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { BrowserWindow } from 'electron'

/** Папка скриншотов экранов во временном каталоге: агент открывает их по пути из сообщения. */
const SCREENSHOT_DIRECTORY = join(tmpdir(), 'atox-canvas')

/** Скриншоты старше суток агенту уже не нужны. */
const SCREENSHOT_MAX_AGE_MS = 24 * 60 * 60 * 1000

/** Дольше скриншот не ждём: просьба уходит агенту и без него. */
const CAPTURE_TIMEOUT_MS = 5000

/** После загрузки страница ещё дорисовывает шрифты и анимации появления. */
const SETTLE_MS = 300

/** Что страница экрана заняла по факту: её содержимое и окно, в котором её мерили. */
export interface ContentSize {
  contentWidth: number
  contentHeight: number
  viewportWidth: number
  viewportHeight: number
}

export interface ScreenRender {
  /** Путь к PNG. */
  path: string
  /** Размеры содержимого; `null` — измерить не удалось. */
  size: ContentSize | null
}

/**
 * Скрытое окно без Node и с песочницей размером ровно с экран: страница по адресу
 * `atox-canvas` (с той же политикой безопасности) видна в нём так, как на холсте. Задача
 * получает окно, когда страница загружена и осела. `null` — загрузка или задача не уложились
 * в срок или упали.
 */
async function inScreenWindow<Result>(
  url: string,
  width: number,
  height: number,
  task: (window: BrowserWindow) => Promise<Result>
): Promise<Result | null> {
  const window = new BrowserWindow({
    show: false,
    width,
    height,
    useContentSize: true,
    // Окно никогда не показывается: без этого скрытая страница может не рисоваться.
    paintWhenInitiallyHidden: true,
    webPreferences: {
      sandbox: true,
      contextIsolation: true,
      nodeIntegration: false,
      backgroundThrottling: false,
      spellcheck: false
    }
  })
  window.webContents.setAudioMuted(true)
  window.webContents.setWindowOpenHandler(() => ({ action: 'deny' }))
  window.webContents.on('will-navigate', (event) => event.preventDefault())
  let timer: NodeJS.Timeout | undefined
  try {
    const timeout = new Promise<never>((_resolve, reject) => {
      timer = setTimeout(() => reject(new Error('Screen render timed out')), CAPTURE_TIMEOUT_MS)
    })
    return await Promise.race([
      (async () => {
        await window.loadURL(url)
        await new Promise((resolve) => setTimeout(resolve, SETTLE_MS))
        return task(window)
      })(),
      timeout
    ])
  } catch (error) {
    console.error('Failed to render a canvas screen', error)
    return null
  } finally {
    clearTimeout(timer)
    window.destroy()
  }
}

/** Размеры содержимого страницы против окна: выход за экран виден по `scrollWidth/Height`. */
async function measure(window: BrowserWindow): Promise<ContentSize | null> {
  const size: unknown = await window.webContents
    .executeJavaScript(
      `(() => {
        const { documentElement: root, body } = document
        return {
          contentWidth: Math.max(root.scrollWidth, body?.scrollWidth ?? 0),
          contentHeight: Math.max(root.scrollHeight, body?.scrollHeight ?? 0),
          viewportWidth: window.innerWidth,
          viewportHeight: window.innerHeight
        }
      })()`
    )
    .catch(() => null)
  const { contentWidth, contentHeight, viewportWidth, viewportHeight } = (size ?? {}) as Record<
    string,
    unknown
  >
  return [contentWidth, contentHeight, viewportWidth, viewportHeight].every(
    (value) => typeof value === 'number' && Number.isFinite(value)
  )
    ? (size as ContentSize)
    : null
}

/**
 * Снимает экран и измеряет его содержимое. Возвращает `null`, если снять не удалось; размер
 * при этом может быть `null`, если не удалось только измерить.
 */
export async function captureScreen(
  url: string,
  width: number,
  height: number
): Promise<ScreenRender | null> {
  const rendered = await inScreenWindow(url, width, height, async (window) => {
    const size = await measure(window)
    const image = await window.webContents.capturePage(undefined, { stayHidden: true })
    return { size, png: image.isEmpty() ? null : image.toPNG() }
  })
  if (!rendered?.png) {
    return null
  }
  try {
    await mkdir(SCREENSHOT_DIRECTORY, { recursive: true })
    void removeOldScreenshots()
    const path = join(SCREENSHOT_DIRECTORY, `screen-${randomUUID()}.png`)
    await writeFile(path, rendered.png)
    return { path, size: rendered.size }
  } catch (error) {
    console.error('Failed to save a canvas screenshot', error)
    return null
  }
}

/** Только измерение, без снимка: для проверки экрана, который агент только что поставил. */
export function measureScreen(
  url: string,
  width: number,
  height: number
): Promise<ContentSize | null> {
  return inScreenWindow(url, width, height, measure).then((size) => size ?? null)
}

async function removeOldScreenshots(): Promise<void> {
  const oldest = Date.now() - SCREENSHOT_MAX_AGE_MS
  const names = await readdir(SCREENSHOT_DIRECTORY).catch(() => [])
  await Promise.all(
    names.map(async (name) => {
      const path = join(SCREENSHOT_DIRECTORY, name)
      const info = await stat(path).catch(() => null)
      if (info && info.mtimeMs < oldest) {
        await rm(path, { force: true }).catch(() => undefined)
      }
    })
  )
}
