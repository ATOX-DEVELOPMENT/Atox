/**
 * Холст чата: у чата он один, а в нём несколько страниц (как страницы в Figma): на каждой свои
 * экраны, группы и линии. Запись `Canvas` ниже — одна такая страница; страницы чата — это все его
 * записи `Canvas`. Страница — это место, где агент показывает экраны — приложение на телефоне, сайт,
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
  web: { name: 'Website', width: 1280, height: 800, frame: 'browser' },
  // Для презентаций и документов: без рамки, чтобы экран был ровно страницей.
  slide: { name: 'Slide', width: 1920, height: 1080, frame: 'none' },
  a4: { name: 'A4 page', width: 794, height: 1123, frame: 'none' }
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

/** Рамка экрана по его устройству: у своего размера (`custom`) её нет. */
export function screenFrameOf(device: ScreenDevice): ScreenFrame {
  return device === 'custom' ? 'none' : SCREEN_DEVICES[device].frame
}

/** Клетка сетки холста, в пикселях холста: экраны и группы встают только по её линиям. */
export const CANVAS_GRID = 40

/** Ближайшая линия сетки. */
export function snapToGrid(value: number): number {
  return Math.round(value / CANVAS_GRID) * CANVAS_GRID
}

/** Ближайшая линия сетки не левее `value`: так экран встаёт после соседа, не наезжая на него. */
export function snapUpToGrid(value: number): number {
  return Math.ceil(value / CANVAS_GRID) * CANVAS_GRID
}

/** Расстояние между рамками экранов на холсте: кратно клетке сетки. */
export const SCREEN_GAP = 120

/** Границы масштаба холста. */
export const CANVAS_ZOOM = { min: 0.1, max: 2, default: 0.6 } as const

/** Сколько версий экрана хранится: старые вытесняются. */
export const SCREEN_HISTORY_LIMIT = 30

/** Длиннее имя страницы или экрана не помещается в подпись. */
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

/** Прямоугольник элемента внутри экрана, в пикселях экрана (от его левого верхнего угла). */
export interface LinkAnchor {
  x: number
  y: number
  width: number
  height: number
}

/**
 * Линия от одного экрана к другому: что за чем идёт. Ставит и убирает только агент. Начинается
 * точкой у кнопки (`on`) на экране-источнике или у края экрана, если кнопки нет; точка — это и есть
 * направление.
 */
export interface CanvasLink {
  id: string
  /** Экран, откуда идёт линия, и экран, куда она приходит (id). */
  from: string
  to: string
  /** Кнопка или другой элемент экрана-источника: её текст или CSS-селектор. */
  on: string | null
  /** Где этот элемент на экране; `null` — не нашли, линия идёт от края экрана. */
  anchor: LinkAnchor | null
}

/** Длиннее название кнопки не нужно; число линий на холсте ограничено ради порядка. */
export const LINK_ON_MAX_LENGTH = 120
export const CANVAS_LINKS_MAX = 200

/**
 * Группа: именованная рамка вокруг нескольких экранов, чтобы нужное находилось сразу. Рамку
 * ставит и убирает агент; человек переименовывает её, тянет вместе с экранами или распускает.
 * Экран входит не больше чем в одну группу. Рамка строится по самим экранам, места она не хранит.
 */
export interface CanvasGroup {
  id: string
  name: string
  /** Экраны группы (id). */
  screens: string[]
}

/** Число групп на холсте ограничено ради порядка. */
export const CANVAS_GROUPS_MAX = 60

/**
 * Поля рамки группы вокруг её экранов, в пикселях холста; кратны клетке сетки, чтобы рамка стояла
 * по сетке вместе со своими экранами. Сверху место под название группы и подписи экранов: они
 * стоят на месте и растут вместе с холстом.
 */
export const GROUP_PADDING = {
  top: CANVAS_GRID * 6,
  side: CANVAS_GRID * 2,
  bottom: CANVAS_GRID * 2
} as const

/** Сдвиг и масштаб холста: окно возвращает человека туда, где он остановился. */
export interface CanvasView {
  x: number
  y: number
  zoom: number
}

/**
 * Холст опубликован по ссылке: любой, у кого она есть, видит снимок всех страниц холста в браузере.
 * Ссылка одна на холст чата, поэтому она записана у всех его страниц.
 */
export interface CanvasShare {
  url: string
  /** Когда в последний раз опубликован снимок: новее правок холста, пока человек не обновит ссылку. */
  publishedAt: number
}

export interface Canvas {
  id: string
  /** Имя страницы: у страниц одного чата разные, по имени агент находит страницу. */
  name: string
  /** Чат холста: в нём агент рисует экраны и в него уходят правки человека. */
  chatId: string
  projectId: string
  screens: CanvasScreen[]
  archived: boolean
  /** Линии между экранами. */
  links: CanvasLink[]
  /** Именованные рамки вокруг экранов. */
  groups: CanvasGroup[]
  /** Ссылка для просмотра; `null` — холст не опубликован. */
  share: CanvasShare | null
  /** Сохранённый вид; нет — окно вписывает все экраны само. */
  view: CanvasView | null
  createdAt: number
  updatedAt: number
}

export interface CanvasState {
  /** Все страницы всех холстов, и в архиве тоже; страницы одного чата — в своём порядке. */
  canvases: Canvas[]
  /** Чаты, холст которых публикуется по ссылке прямо сейчас. */
  sharing: string[]
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

/** Во что выгружаются экраны холста. */
export const CANVAS_EXPORT_FORMATS = ['pdf', 'png', 'pptx'] as const

export type CanvasExportFormat = (typeof CANVAS_EXPORT_FORMATS)[number]

export function isCanvasExportFormat(value: unknown): value is CanvasExportFormat {
  return typeof value === 'string' && (CANVAS_EXPORT_FORMATS as readonly string[]).includes(value)
}

/** Расширение файла выгрузки: PNG выгружается папкой, у неё расширения нет. */
export const CANVAS_EXPORT_EXTENSIONS: Record<CanvasExportFormat, string> = {
  pdf: '.pdf',
  png: '',
  pptx: '.pptx'
}

/** Результат выгрузки: куда легли файлы и сколько экранов в них вошло. */
export interface CanvasExportResult {
  /** Файл (PDF, PPTX) или папка с PNG. */
  path: string
  screens: number
  /** Экраны, которые вошли в выгрузку не в том виде: не собрались или потеряли файл. */
  warnings: string[]
}
