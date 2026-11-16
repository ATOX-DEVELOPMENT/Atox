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

/**
 * Снимает экран так, как его видит холст: страница по адресу `atox-canvas` (с той же
 * политикой безопасности) в скрытом окне без Node и с песочницей, размером ровно с экран.
 * Возвращает путь к PNG или `null`, если снять не удалось.
 */
export async function captureScreen(
  url: string,
  width: number,
  height: number
): Promise<string | null> {
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
      timer = setTimeout(() => reject(new Error('Screen capture timed out')), CAPTURE_TIMEOUT_MS)
    })
    const image = await Promise.race([
      (async () => {
        await window.loadURL(url)
        await new Promise((resolve) => setTimeout(resolve, SETTLE_MS))
        return window.webContents.capturePage(undefined, { stayHidden: true })
      })(),
      timeout
    ])
    if (image.isEmpty()) {
      throw new Error('The captured image is empty')
    }
    await mkdir(SCREENSHOT_DIRECTORY, { recursive: true })
    void removeOldScreenshots()
    const path = join(SCREENSHOT_DIRECTORY, `screen-${randomUUID()}.png`)
    await writeFile(path, image.toPNG())
    return path
  } catch (error) {
    console.error('Failed to capture a canvas screen', error)
    return null
  } finally {
    clearTimeout(timer)
    window.destroy()
  }
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
