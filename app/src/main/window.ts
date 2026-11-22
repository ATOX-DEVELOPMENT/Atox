import { join } from 'node:path'
import { BrowserWindow, nativeTheme, shell, type BrowserWindowConstructorOptions } from 'electron'
import { EXTERNAL_LINK_PROTOCOLS } from '../shared/links'
import { IS_MAC } from '../shared/platform'

const WINDOW_SIZE = {
  width: 1200,
  height: 780,
  minWidth: 720,
  minHeight: 480
} as const

/** Фон окна до первой отрисовки — цвет чата (`--color-surface` в стилях), на нём лежит сайдбар. */
const WINDOW_BACKGROUND = { light: '#f3f2f7', dark: '#1c1c1e' } as const

/**
 * Левый верхний угол кнопок окна macOS: они стоят в верхней таблетке сайдбара, по её вертикальному
 * центру и с отступом 14px от скруглённого края. Числа считаются от `--sidebar-gap` (8px),
 * `--window-pill-height` (40px) и рамки таблетки (1px) в стилях.
 */
const TRAFFIC_LIGHTS_POSITION = { x: 23, y: 22 } as const

/**
 * На macOS кнопки окна встроены в сайдбар. На Linux окно обычное: рамку рисует оконный менеджер
 * (в Hyprland её нет вовсе), строка меню скрыта.
 */
function platformWindowOptions(): BrowserWindowConstructorOptions {
  return {
    backgroundColor: WINDOW_BACKGROUND[nativeTheme.shouldUseDarkColors ? 'dark' : 'light'],
    ...(IS_MAC && {
      titleBarStyle: 'hiddenInset' as const,
      trafficLightPosition: TRAFFIC_LIGHTS_POSITION
    })
  }
}

/** Адрес dev-сервера renderer'а; electron-vite задаёт его только в режиме разработки. */
const devServerUrl = process.env['ELECTRON_RENDERER_URL']

/**
 * Источник окна приложения для `frame-ancestors`: dev-сервер при разработке, файлы приложения
 * в сборке. Только окно приложения может встраивать страницы, которые отдаёт приложение.
 */
export const APP_FRAME_SOURCE = devServerUrl ? new URL(devServerUrl).origin : 'file:'

export function createMainWindow(): BrowserWindow {
  const window = new BrowserWindow({
    ...WINDOW_SIZE,
    show: false,
    ...platformWindowOptions(),
    webPreferences: {
      preload: join(__dirname, '../preload/index.js'),
      contextIsolation: true,
      nodeIntegration: false,
      sandbox: true
    }
  })

  if (!IS_MAC) {
    // Меню остаётся ради горячих клавиш, но строку меню над терминалом не показываем.
    window.setMenuBarVisibility(false)
  }
  window.once('ready-to-show', () => window.show())

  // Ссылки из приложения (в том числе из терминала) открываются в системном браузере или почте,
  // а не в новых окнах Electron. Другие схемы не открываем: их мог подставить вывод программы.
  // Файлы из ответов агента открывает сам ответ через `files.open`.
  window.webContents.setWindowOpenHandler(({ url }) => {
    if (URL.canParse(url) && EXTERNAL_LINK_PROTOCOLS.has(new URL(url).protocol)) {
      void shell.openExternal(url)
    }
    return { action: 'deny' }
  })

  // Файл, брошенный мимо терминала, иначе открылся бы в окне вместо приложения.
  window.webContents.on('will-navigate', (event) => event.preventDefault())

  if (devServerUrl) {
    void window.loadURL(devServerUrl)
  } else {
    void window.loadFile(join(__dirname, '../renderer/index.html'))
  }

  return window
}
