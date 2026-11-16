import {
  CANVAS_ZOOM,
  SCREEN_DEVICES,
  type CanvasScreen,
  type CanvasView,
  type ScreenFrame
} from '../../../shared/canvas'

/** Прямоугольник в координатах холста или окна. */
export interface Rect {
  x: number
  y: number
  width: number
  height: number
}

export interface Size {
  width: number
  height: number
}

export interface Point {
  x: number
  y: number
}

/** Толщина рамки устройства вокруг экрана, в пикселях холста. */
export interface FrameInsets {
  top: number
  right: number
  bottom: number
  left: number
}

/**
 * Рамки устройств: телефон и планшет — корпус вокруг экрана, окно и браузер — полоса сверху
 * (заголовок окна, адресная строка). Те же числа CSS получает переменными, чтобы рамка
 * и расчёты вписывания совпадали.
 */
export const FRAME_INSETS: Record<ScreenFrame, FrameInsets> = {
  phone: { top: 12, right: 12, bottom: 12, left: 12 },
  tablet: { top: 18, right: 18, bottom: 18, left: 18 },
  window: { top: 40, right: 0, bottom: 0, left: 0 },
  browser: { top: 44, right: 0, bottom: 0, left: 0 },
  none: { top: 0, right: 0, bottom: 0, left: 0 }
}

/** Рамка экрана: у своего размера (`custom`) её нет. */
export function screenFrame(screen: Pick<CanvasScreen, 'device'>): ScreenFrame {
  return screen.device === 'custom' ? 'none' : SCREEN_DEVICES[screen.device].frame
}

/** Экран вместе с рамкой устройства: (x, y) экрана — угол самой рамки. */
export function screenBounds(screen: CanvasScreen, position: Point = screen): Rect {
  const insets = FRAME_INSETS[screenFrame(screen)]
  return {
    x: position.x,
    y: position.y,
    width: screen.width + insets.left + insets.right,
    height: screen.height + insets.top + insets.bottom
  }
}

/** Общий прямоугольник; `null` — прямоугольников нет. */
export function unionRect(rects: readonly Rect[]): Rect | null {
  if (rects.length === 0) {
    return null
  }
  const left = Math.min(...rects.map(({ x }) => x))
  const top = Math.min(...rects.map(({ y }) => y))
  const right = Math.max(...rects.map(({ x, width }) => x + width))
  const bottom = Math.max(...rects.map(({ y, height }) => y + height))
  return { x: left, y: top, width: right - left, height: bottom - top }
}

export function clampZoom(zoom: number): number {
  return Math.min(CANVAS_ZOOM.max, Math.max(CANVAS_ZOOM.min, zoom))
}

/**
 * Вид, в котором `content` целиком помещается в окно `viewport` с отступом `margin` (в пикселях
 * окна) и стоит по центру. Крупнее 100% вписывание не увеличивает: мелкий экран остаётся
 * в настоящем размере.
 */
export function fitView(content: Rect, viewport: Size, margin: number): CanvasView {
  const width = Math.max(1, viewport.width - margin * 2)
  const height = Math.max(1, viewport.height - margin * 2)
  const zoom = clampZoom(Math.min(width / content.width, height / content.height, 1))
  return {
    zoom,
    x: viewport.width / 2 - (content.x + content.width / 2) * zoom,
    y: viewport.height / 2 - (content.y + content.height / 2) * zoom
  }
}

/** Новый масштаб, при котором точка холста под `anchor` (в пикселях окна) остаётся на месте. */
export function zoomAround(view: CanvasView, anchor: Point, zoom: number): CanvasView {
  const next = clampZoom(zoom)
  const ratio = next / view.zoom
  return {
    zoom: next,
    x: anchor.x - (anchor.x - view.x) * ratio,
    y: anchor.y - (anchor.y - view.y) * ratio
  }
}

/** Прямоугольник холста в пикселях окна. */
export function toViewport(view: CanvasView, rect: Rect): Rect {
  return {
    x: rect.x * view.zoom + view.x,
    y: rect.y * view.zoom + view.y,
    width: rect.width * view.zoom,
    height: rect.height * view.zoom
  }
}

/** Видимая часть холста в его координатах. */
export function visibleArea(view: CanvasView, viewport: Size): Rect {
  return {
    x: -view.x / view.zoom,
    y: -view.y / view.zoom,
    width: viewport.width / view.zoom,
    height: viewport.height / view.zoom
  }
}

export function intersects(a: Rect, b: Rect): boolean {
  return a.x < b.x + b.width && b.x < a.x + a.width && a.y < b.y + b.height && b.y < a.y + a.height
}

/** Прямоугольник, раздвинутый на `amount` во все стороны. */
export function inflate(rect: Rect, amount: number): Rect {
  return {
    x: rect.x - amount,
    y: rect.y - amount,
    width: rect.width + amount * 2,
    height: rect.height + amount * 2
  }
}

/** Множитель масштаба за одно событие колеса: щипок трекпада даёт мелкие шаги, колесо — крупные. */
export function wheelZoomFactor(deltaY: number, sensitivity: number): number {
  return Math.exp(-deltaY * sensitivity)
}

/** Площадь пересечения двух прямоугольников. */
export function overlapArea(a: Rect, b: Rect): number {
  const width = Math.min(a.x + a.width, b.x + b.width) - Math.max(a.x, b.x)
  const height = Math.min(a.y + a.height, b.y + b.height) - Math.max(a.y, b.y)
  return width > 0 && height > 0 ? width * height : 0
}

/**
 * Где поставить всплывающее окно размера `box` рядом с `target` (всё в пикселях окна): под ним,
 * справа, слева или над ним, по левому или по правому краю цели. Берётся первое место, которое
 * помещается в `viewport` и не закрывает другие экраны (`obstacles`); если свободного нет —
 * то, что закрывает их меньше всех; если ничего не помещается — под целью, прижатое к краям.
 */
export function placeBeside(
  target: Rect,
  box: Size,
  viewport: Size,
  obstacles: readonly Rect[],
  gap: number,
  margin: number
): Point {
  const clampX = (x: number) => Math.max(margin, Math.min(x, viewport.width - margin - box.width))
  const clampY = (y: number) => Math.max(margin, Math.min(y, viewport.height - margin - box.height))
  const startX = clampX(target.x)
  const endX = clampX(target.x + target.width - box.width)
  const below = target.y + target.height + gap
  const above = target.y - gap - box.height
  const candidates: Point[] = [
    { x: startX, y: below },
    { x: endX, y: below },
    { x: target.x + target.width + gap, y: clampY(target.y) },
    { x: target.x - gap - box.width, y: clampY(target.y) },
    { x: startX, y: above },
    { x: endX, y: above }
  ]
  const fits = ({ x, y }: Point) =>
    x >= margin &&
    y >= margin &&
    x + box.width <= viewport.width - margin &&
    y + box.height <= viewport.height - margin
  const covered = (point: Point) =>
    obstacles.reduce((sum, rect) => sum + overlapArea({ ...point, ...box }, rect), 0)
  const inside = candidates.filter(fits)
  if (inside.length > 0) {
    return inside.reduce((best, point) => (covered(point) < covered(best) ? point : best))
  }
  return { x: startX, y: clampY(below) }
}
