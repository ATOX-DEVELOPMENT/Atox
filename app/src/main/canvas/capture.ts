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
const CAPTURE_TIMEOUT_MS = 10_000

/** После загрузки страница ещё дорисовывает шрифты и анимации появления. */
const SETTLE_MS = 300

/**
 * Tailwind собирает стили уже в окне, и в первый раз за запуск приложения это долго
 * (разбор WebAssembly): снимок раньше показал бы экран без оформления.
 */
const STYLES_POLL_MS = 50
const STYLES_WAIT_MS = 6000

/** Страница с Tailwind готова, когда он собрал стили и перестал их менять. */
const STYLES_STATE_SCRIPT = `(() => {
  if (!document.querySelector('style[type="text/tailwindcss"]')) {
    return null
  }
  const built = [...document.querySelectorAll('style')].find((style) =>
    style.textContent.startsWith('/*! tailwindcss')
  )
  return built ? built.textContent.length : 0
})()`

/** Что страница экрана заняла по факту: её содержимое и окно, в котором её мерили. */
export interface ContentSize {
  contentWidth: number
  contentHeight: number
  viewportWidth: number
  viewportHeight: number
}

/** Что показала страница экрана: размеры содержимого и ошибки, которые она вывела. */
export interface ScreenInspection {
  /** Размеры содержимого; `null` — измерить не удалось. */
  size: ContentSize | null
  /** Ошибки страницы: необработанные исключения, `console.error`, запреты политики. */
  errors: string[]
}

export interface ScreenRender extends ScreenInspection {
  /** Путь к PNG. */
  path: string
}

/** Сколько ошибок страницы показывать: первые обычно и есть причина остальных. */
const MAX_PAGE_ERRORS = 5

/** Ошибка страницы в одну строку: стек агенту ни к чему. */
const MAX_PAGE_ERROR_LENGTH = 300

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
  task: (window: BrowserWindow, errors: string[]) => Promise<Result>
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
  const errors: string[] = []
  window.webContents.on('console-message', ({ level, message }) => {
    const line = message.split('\n')[0]?.trim().slice(0, MAX_PAGE_ERROR_LENGTH)
    if (level === 'error' && line && errors.length < MAX_PAGE_ERRORS && !errors.includes(line)) {
      errors.push(line)
    }
  })
  let timer: NodeJS.Timeout | undefined
  try {
    const timeout = new Promise<never>((_resolve, reject) => {
      timer = setTimeout(() => reject(new Error('Screen render timed out')), CAPTURE_TIMEOUT_MS)
    })
    return await Promise.race([
      (async () => {
        await window.loadURL(url)
        await new Promise((resolve) => setTimeout(resolve, SETTLE_MS))
        await waitForStyles(window)
        return task(window, errors)
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

/** Ждёт, пока Tailwind соберёт стили; страницы без Tailwind и сбой ожидания — не ждут. */
async function waitForStyles(window: BrowserWindow): Promise<void> {
  const deadline = Date.now() + STYLES_WAIT_MS
  let previous: unknown
  while (Date.now() < deadline) {
    const state: unknown = await window.webContents
      .executeJavaScript(STYLES_STATE_SCRIPT)
      .catch(() => null)
    if (state === null || (typeof state === 'number' && state > 0 && state === previous)) {
      return
    }
    previous = state
    await new Promise((resolve) => setTimeout(resolve, STYLES_POLL_MS))
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
  const rendered = await inScreenWindow(url, width, height, async (window, errors) => {
    const size = await measure(window)
    const image = await window.webContents.capturePage(undefined, { stayHidden: true })
    return { size, errors: [...errors], png: image.isEmpty() ? null : image.toPNG() }
  })
  if (!rendered?.png) {
    return null
  }
  try {
    await mkdir(SCREENSHOT_DIRECTORY, { recursive: true })
    void removeOldScreenshots()
    const path = join(SCREENSHOT_DIRECTORY, `screen-${randomUUID()}.png`)
    await writeFile(path, rendered.png)
    return { path, size: rendered.size, errors: rendered.errors }
  } catch (error) {
    console.error('Failed to save a canvas screenshot', error)
    return null
  }
}

/** Пикселей CSS в дюйме: в таких единицах PDF задаёт размер страницы. */
const CSS_PIXELS_PER_INCH = 96

/** Узкие экраны (телефон, сайт) снимаются вдвое чётче; широкие, вроде слайда 1920 px, и так крупные. */
const EXPORT_SHARP_BELOW_WIDTH = 1600

/**
 * Экран как PDF-страница ровно его размера, с настоящим текстом и векторной графикой. То, что
 * не поместилось по высоте, обрезается: лишних страниц у экрана не бывает.
 */
export function renderScreenPdf(url: string, width: number, height: number): Promise<Buffer | null> {
  return inScreenWindow(url, width, height, (window) =>
    window.webContents.printToPDF({
      pageSize: { width: width / CSS_PIXELS_PER_INCH, height: height / CSS_PIXELS_PER_INCH },
      margins: { top: 0, bottom: 0, left: 0, right: 0 },
      printBackground: true,
      pageRanges: '1'
    })
  )
}

/**
 * Экран как PNG для выгрузки. Плотность задана явно (не зависит от монитора): вдвое чётче для
 * узких экранов, обычная для широких.
 */
export function renderScreenImage(url: string, width: number, height: number): Promise<Buffer | null> {
  return inScreenWindow(url, width, height, async (window) => {
    const devtools = window.webContents.debugger
    devtools.attach('1.3')
    try {
      await devtools.sendCommand('Emulation.setDeviceMetricsOverride', {
        width,
        height,
        deviceScaleFactor: width < EXPORT_SHARP_BELOW_WIDTH ? 2 : 1,
        mobile: false
      })
      const { data } = (await devtools.sendCommand('Page.captureScreenshot', {
        format: 'png'
      })) as { data: string }
      return Buffer.from(data, 'base64')
    } finally {
      devtools.detach()
    }
  })
}

/** Только проверка, без снимка: для экрана, который агент только что поставил. */
export function inspectScreen(
  url: string,
  width: number,
  height: number
): Promise<ScreenInspection | null> {
  return inScreenWindow(url, width, height, async (window, errors) => ({
    size: await measure(window),
    errors: [...errors]
  }))
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
