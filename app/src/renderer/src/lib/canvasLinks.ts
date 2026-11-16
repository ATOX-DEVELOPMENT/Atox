import type { CanvasLink, CanvasScreen } from '../../../shared/canvas'
import { FRAME_INSETS, screenFrame, type Point, type Rect } from './canvasView'

/** Сторона экрана, с которой линия уходит к другому экрану. */
type Side = 'left' | 'right' | 'top' | 'bottom'

/** Линия, готовая к рисованию: путь и точка, с которой она начинается. */
export interface LinkShape {
  id: string
  /** Кривая Безье в координатах холста. */
  path: string
  /** Начало линии: здесь рисуется точка — по ней видно, откуда идёт линия. */
  start: Point
}

/** Отступ от угла экрана, куда линия не приходит: ближе к углу рамка скругляется. */
const END_MARGIN = 28
/** Насколько линия тянется прямо, прежде чем повернуть, в пикселях холста. */
const CURVE_MIN = 48
const CURVE_MAX = 200

function clamp(value: number, min: number, max: number): number {
  return Math.min(Math.max(value, min), Math.max(min, max))
}

/** С какой стороны исходного экрана линия уходит: туда, где лежит целевой. */
function exitSide(from: Rect, to: Rect): Side {
  if (to.x >= from.x + from.width) {
    return 'right'
  }
  if (to.x + to.width <= from.x) {
    return 'left'
  }
  if (to.y >= from.y + from.height) {
    return 'bottom'
  }
  if (to.y + to.height <= from.y) {
    return 'top'
  }
  // Экраны наложены друг на друга: по тому, куда сдвинут центр.
  const dx = to.x + to.width / 2 - (from.x + from.width / 2)
  const dy = to.y + to.height / 2 - (from.y + from.height / 2)
  return Math.abs(dx) >= Math.abs(dy) ? (dx >= 0 ? 'right' : 'left') : dy >= 0 ? 'bottom' : 'top'
}

/** Где на экране, в координатах холста, элемент линии: внутри рамки устройства, не выходя за экран. */
function elementRect(screen: CanvasScreen, bounds: Rect, link: CanvasLink): Rect | null {
  const { anchor } = link
  if (!anchor) {
    return null
  }
  const insets = FRAME_INSETS[screenFrame(screen)]
  const left = bounds.x + insets.left
  const top = bounds.y + insets.top
  const x = clamp(anchor.x, 0, screen.width)
  const y = clamp(anchor.y, 0, screen.height)
  return {
    x: left + x,
    y: top + y,
    width: clamp(anchor.width, 0, screen.width - x),
    height: clamp(anchor.height, 0, screen.height - y)
  }
}

/** Линия от экрана или кнопки на нём к целевому экрану; `null` — один из экранов не найден. */
export function linkShape(
  link: CanvasLink,
  screens: ReadonlyMap<string, CanvasScreen>,
  bounds: ReadonlyMap<string, Rect>
): LinkShape | null {
  const source = screens.get(link.from)
  const from = bounds.get(link.from)
  const to = bounds.get(link.to)
  if (!source || !from || !to) {
    return null
  }
  const side = exitSide(from, to)
  const element = elementRect(source, from, link)
  const horizontal = side === 'left' || side === 'right'
  const sign = side === 'right' || side === 'bottom' ? 1 : -1

  // Начало: край кнопки, обращённый к целевому экрану, или середина края экрана.
  const origin = element ?? from
  const start: Point = horizontal
    ? {
        x: sign === 1 ? origin.x + origin.width : origin.x,
        y: origin.y + origin.height / 2
      }
    : {
        x: origin.x + origin.width / 2,
        y: sign === 1 ? origin.y + origin.height : origin.y
      }
  // Конец: ближний к источнику край целевого экрана, на той же высоте (ширине), если можно.

  const end: Point = horizontal
    ? {
        x: sign === 1 ? to.x : to.x + to.width,
        y: clamp(start.y, to.y + END_MARGIN, to.y + to.height - END_MARGIN)
      }
    : {
        x: clamp(start.x, to.x + END_MARGIN, to.x + to.width - END_MARGIN),
        y: sign === 1 ? to.y : to.y + to.height
      }

  const distance = horizontal ? Math.abs(end.x - start.x) : Math.abs(end.y - start.y)
  const reach = clamp(distance / 2, CURVE_MIN, CURVE_MAX)
  const c1: Point = horizontal
    ? { x: start.x + sign * reach, y: start.y }
    : { x: start.x, y: start.y + sign * reach }
  const c2: Point = horizontal
    ? { x: end.x - sign * reach, y: end.y }
    : { x: end.x, y: end.y - sign * reach }

  return {
    id: link.id,
    path: `M ${start.x} ${start.y} C ${c1.x} ${c1.y}, ${c2.x} ${c2.y}, ${end.x} ${end.y}`,
    start
  }
}
