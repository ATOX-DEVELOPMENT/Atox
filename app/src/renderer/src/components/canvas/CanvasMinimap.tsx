import { useEffect, useReducer, useRef, type PointerEvent } from 'react'
import {
  inflate,
  unionRect,
  visibleArea,
  type Point,
  type Rect
} from '../../lib/canvasView'
import type { ViewState } from './viewState'

/** Поле вокруг экранов на мини-карте, в долях её содержимого. */
const MINIMAP_PADDING = 0.08

interface CanvasMinimapProps {
  viewState: ViewState
  /** Экраны в координатах холста. */
  rects: readonly Rect[]
  /** Ставит центр вида в эту точку холста. */
  onCenter(point: Point): void
}

/** Мини-карта: экраны и видимая часть холста; клик или протяжка по ней переносит вид. */
export function CanvasMinimap({ viewState, rects, onCenter }: CanvasMinimapProps) {
  const mapRef = useRef<HTMLDivElement>(null)
  const [, redraw] = useReducer((count: number) => count + 1, 0)
  useEffect(() => viewState.subscribe(redraw), [viewState])

  const view = viewState.view()
  const map = mapRef.current
  const content = view && unionRect([...rects, visibleArea(view, viewState.viewport())])
  const world = content && inflate(content, Math.max(content.width, content.height) * MINIMAP_PADDING)
  const scale =
    world && map ? Math.min(map.clientWidth / world.width, map.clientHeight / world.height) : 0
  // Содержимое стоит по центру карты.
  const offset =
    world && map
      ? {
          x: (map.clientWidth - world.width * scale) / 2 - world.x * scale,
          y: (map.clientHeight - world.height * scale) / 2 - world.y * scale
        }
      : { x: 0, y: 0 }
  const place = (rect: Rect) => ({
    left: rect.x * scale + offset.x,
    top: rect.y * scale + offset.y,
    width: rect.width * scale,
    height: rect.height * scale
  })

  const centerAt = (event: PointerEvent<HTMLDivElement>) => {
    if (!scale) {
      return
    }
    const bounds = event.currentTarget.getBoundingClientRect()
    onCenter({
      x: (event.clientX - bounds.left - offset.x) / scale,
      y: (event.clientY - bounds.top - offset.y) / scale
    })
  }

  return (
    <div
      ref={mapRef}
      className="canvas-minimap"
      data-canvas-ui
      role="presentation"
      onPointerDown={(event) => {
        event.currentTarget.setPointerCapture(event.pointerId)
        centerAt(event)
      }}
      onPointerMove={(event) => {
        if (event.currentTarget.hasPointerCapture(event.pointerId)) {
          centerAt(event)
        }
      }}
    >
      {scale > 0 &&
        rects.map((rect, index) => (
          <i key={index} className="canvas-minimap__screen" style={place(rect)} />
        ))}
      {scale > 0 && view && (
        <span
          className="canvas-minimap__viewport"
          style={place(visibleArea(view, viewState.viewport()))}
        />
      )}
    </div>
  )
}
