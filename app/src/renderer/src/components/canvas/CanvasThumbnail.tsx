import type { CanvasScreen } from '../../../../shared/canvas'
import { screenBounds, screenFrame, unionRect, type Rect } from '../../lib/canvasView'

/** Поле вокруг экранов в миниатюре, в долях её размера. */
const THUMBNAIL_PADDING = 0.12
/** Скругление в долях ширины экрана: у телефона оно заметное, у окна — едва. */
const PHONE_RADIUS = 0.14
const WINDOW_RADIUS = 0.025
/** Отступ строк-заглушек от краёв и их толщина, в долях экрана. */
const LINE_INSET = 0.1
const LINE_THICKNESS = 0.05
/** Строки-заглушки: где стоят (доля высоты) и какой длины (доля ширины); первая — заголовок. */
const LINES = [
  { top: 0.1, length: 0.8, accent: true },
  { top: 0.2, length: 0.55, accent: false },
  { top: 0.28, length: 0.62, accent: false },
  { top: 0.36, length: 0.48, accent: false }
] as const

/**
 * Схема холста для карточки: экраны прямоугольниками на своих местах и в своих пропорциях.
 * Без iframe — список холстов не загружает их HTML.
 */
export function CanvasThumbnail({ screens }: { screens: readonly CanvasScreen[] }) {
  const bounds = screens.map((screen) => ({ screen, rect: screenBounds(screen) }))
  const content = unionRect(bounds.map(({ rect }) => rect))

  return (
    <div className="canvas-thumbnail" aria-hidden>
      {content && (
        <svg
          className="canvas-thumbnail__map"
          viewBox={[
            content.x - content.width * THUMBNAIL_PADDING,
            content.y - content.height * THUMBNAIL_PADDING,
            content.width * (1 + THUMBNAIL_PADDING * 2),
            content.height * (1 + THUMBNAIL_PADDING * 2)
          ].join(' ')}
          preserveAspectRatio="xMidYMid meet"
        >
          {bounds.map(({ screen, rect }) => {
            const radius =
              rect.width * (screenFrame(screen) === 'phone' ? PHONE_RADIUS : WINDOW_RADIUS)
            return (
              <g key={screen.id} className="canvas-thumbnail__screen">
                <rect x={rect.x} y={rect.y} width={rect.width} height={rect.height} rx={radius} />
                <ScreenLines {...rect} />
              </g>
            )
          })}
        </svg>
      )}
    </div>
  )
}

/** Несколько строк-заглушек: прямоугольник читается как экран с содержимым. */
function ScreenLines({ x, y, width, height }: Rect) {
  const inset = width * LINE_INSET
  const line = Math.min(height, width) * LINE_THICKNESS
  return (
    <>
      {LINES.map(({ top, length, accent }) => (
        <rect
          key={top}
          className="canvas-thumbnail__line"
          data-accent={accent}
          x={x + inset}
          y={y + height * top}
          width={(width - inset * 2) * length}
          height={line}
          rx={line / 2}
        />
      ))}
    </>
  )
}
