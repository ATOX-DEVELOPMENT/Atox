import { memo, useMemo } from 'react'
import type { CanvasLink, CanvasScreen } from '../../../../shared/canvas'
import { linkShape } from '../../lib/canvasLinks'
import type { Rect } from '../../lib/canvasView'

interface CanvasLinksProps {
  links: readonly CanvasLink[]
  screens: readonly CanvasScreen[]
  /** Рамки экранов вместе с устройством, с учётом переносимого сейчас экрана. */
  bounds: ReadonlyMap<string, Rect>
}

/**
 * Линии между экранами: что за чем идёт. Рисуются в координатах холста поверх экранов и не
 * ловят указатель. Начинаются точкой у кнопки или у края экрана — по ней видно направление.
 * Толщина линии и точка не растут вместе с масштабом (`--z` берётся из сцены).
 */
export const CanvasLinks = memo(function CanvasLinks({ links, screens, bounds }: CanvasLinksProps) {
  const shapes = useMemo(() => {
    const byId = new Map(screens.map((screen) => [screen.id, screen]))
    return links.flatMap((link) => linkShape(link, byId, bounds) ?? [])
  }, [links, screens, bounds])

  if (shapes.length === 0) {
    return null
  }
  return (
    <svg className="canvas-links" width={1} height={1} aria-hidden>
      {shapes.map(({ id, path, start }) => (
        <g key={id} className="canvas-link">
          <path className="canvas-link__line" d={path} />
          <circle className="canvas-link__dot" cx={start.x} cy={start.y} />
        </g>
      ))}
    </svg>
  )
})
