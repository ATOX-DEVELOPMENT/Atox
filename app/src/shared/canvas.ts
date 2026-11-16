/**
 * Холст: отдельная страница, где агент показывает экраны — приложение на телефоне, сайт,
 * программу для компьютера. Холст привязан к чату и к его проекту. Экраны рисует только агент
 * (HTML-файлом в проекте, командой `atox canvas`); человек двигает их, называет и увеличивает.
 * Клик по экрану открывает окно «Fix»: текст и скриншот экрана уходят в чат холста.
 */

/** Рамка, в которую окно рисует экран. */
export type ScreenFrame = 'phone' | 'tablet' | 'window' | 'browser' | 'none'

export interface DevicePreset {
  name: string
  /** Размер экрана в CSS-пикселях: так его видит HTML. */
  width: number
  height: number
  frame: ScreenFrame
}

/** Устройства, которые агент называет в `atox canvas screen set --device`. */
export const SCREEN_DEVICES = {
  iphone: { name: 'iPhone', width: 390, height: 844, frame: 'phone' },
  android: { name: 'Android', width: 412, height: 915, frame: 'phone' },
  tablet: { name: 'Tablet', width: 820, height: 1180, frame: 'tablet' },
  desktop: { name: 'Desktop app', width: 1100, height: 700, frame: 'window' },
  web: { name: 'Website', width: 1280, height: 800, frame: 'browser' }
} as const satisfies Record<string, DevicePreset>

export type ScreenDeviceId = keyof typeof SCREEN_DEVICES

/** Устройство экрана: из списка или свой размер без рамки. */
export type ScreenDevice = ScreenDeviceId | 'custom'

export const DEFAULT_SCREEN_DEVICE: ScreenDeviceId = 'iphone'

export function isScreenDeviceId(value: unknown): value is ScreenDeviceId {
  return typeof value === 'string' && Object.hasOwn(SCREEN_DEVICES, value)
}

/** Свой размер экрана в пикселях: меньше не видно, больше тянет память. */
export const SCREEN_SIZE = { min: 120, max: 4000 } as const

/** Расстояние между рамками экранов на холсте. */
export const SCREEN_GAP = 120

/** Границы масштаба холста. */
export const CANVAS_ZOOM = { min: 0.1, max: 2, default: 0.6 } as const

/** Сколько версий экрана хранится: старые вытесняются. */
export const SCREEN_HISTORY_LIMIT = 30

/** Длиннее имя холста или экрана не помещается в подпись. */
export const CANVAS_NAME_MAX_LENGTH = 60

/** Файл экрана: HTML показывается как есть, React-компонент (`export default`) собирается приложением. */
export const HTML_SCREEN_EXTENSIONS = ['.html', '.htm'] as const
export const REACT_SCREEN_EXTENSIONS = ['.tsx', '.jsx'] as const

export type ScreenSourceKind = 'html' | 'react'

/** Вид файла экрана по его имени; `null` — такой файл экраном быть не может. */
export function screenSourceKind(file: string): ScreenSourceKind | null {
  const name = file.toLowerCase()
  if (HTML_SCREEN_EXTENSIONS.some((extension) => name.endsWith(extension))) {
    return 'html'
  }
  if (REACT_SCREEN_EXTENSIONS.some((extension) => name.endsWith(extension))) {
    return 'react'
  }
  return null
}

export interface CanvasScreen {
  id: string
  /** Имя: агент даёт при создании, человек может изменить. По имени агент находит экран. */
  name: string
  device: ScreenDevice
  width: number
  height: number
  /**
   * Абсолютный путь к файлу экрана в проекте: HTML или React-компонент. Приложение следит за
   * файлом и всем, что он импортирует, и обновляет экран.
   */
  file: string
  /** Левый верхний угол экрана на холсте, в координатах холста. */
  x: number
  y: number
  /** Растёт при каждом изменении файла: по нему окно перезагружает экран. */
  revision: number
  /** Файл пропал или не читается: экран показывает последнюю сохранённую версию. */
  missing: boolean
  /**
   * Сборка React-экрана не удалась: здесь текст ошибки, а экран показывает последнюю удачную
   * сборку. `null` — ошибок нет (и у HTML-экрана тоже).
   */
  buildError: string | null
  updatedAt: number
}

/** Сдвиг и масштаб холста: окно возвращает человека туда, где он остановился. */
export interface CanvasView {
  x: number
  y: number
  zoom: number
}

export interface Canvas {
  id: string
  name: string
  /** Чат холста: в нём агент рисует экраны и в него уходят правки человека. */
  chatId: string
  projectId: string
  screens: CanvasScreen[]
  archived: boolean
  /** Сохранённый вид; нет — окно вписывает все экраны само. */
  view: CanvasView | null
  createdAt: number
  updatedAt: number
}

export interface CanvasState {
  /** Все холсты, и в архиве тоже. */
  canvases: Canvas[]
}

/** Версия экрана: снимок его HTML, который приложение сохранило при изменении файла. */
export interface ScreenVersion {
  id: string
  savedAt: number
  /** Что породило версию. */
  cause: 'created' | 'edit' | 'restore'
  /** Просьба человека («Fix»), после которой версия появилась; нет — правка не по просьбе. */
  fix?: string
}

/**
 * Адрес экрана для iframe. Отдаёт его протокол `atox-canvas` в основном процессе, со строгой
 * политикой безопасности (CSP): без сети и без доступа к приложению. `versionId` — старая версия.
 */
export const CANVAS_PROTOCOL = 'atox-canvas'

export function canvasScreenUrl(
  canvasId: string,
  screenId: string,
  revision: number,
  versionId?: string
): string {
  const version = versionId ? `&v=${encodeURIComponent(versionId)}` : ''
  return `${CANVAS_PROTOCOL}://screen/${canvasId}/${screenId}?r=${revision}${version}`
}
