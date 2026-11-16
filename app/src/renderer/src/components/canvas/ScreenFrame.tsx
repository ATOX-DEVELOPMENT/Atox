import { memo, useState, type CSSProperties, type PointerEvent } from 'react'
import { TriangleAlert } from 'lucide-react'
import {
  CANVAS_NAME_MAX_LENGTH,
  canvasScreenUrl,
  SCREEN_DEVICES,
  type CanvasScreen,
  type ScreenFrame as FrameKind
} from '../../../../shared/canvas'
import { FRAME_INSETS, screenFrame, type Point } from '../../lib/canvasView'
import { InlineRename } from '../InlineRename'

interface ScreenFrameProps {
  canvasId: string
  screen: CanvasScreen
  /** Где стоит экран: пока его тянут, позиция отличается от сохранённой. */
  position: Point
  selected: boolean
  /** Экран тянут прямо сейчас. */
  dragging: boolean
  /** Версия из истории, которую показывает экран вместо текущей. */
  previewVersionId: string | null
  onPointerDown(screenId: string, event: PointerEvent<HTMLElement>): void
  /** Открывает «Fix» у экрана — с клавиатуры; мышью это решает `onPointerDown`. */
  onSelect(screenId: string): void
}

/** Подпись устройства: «iPhone 390 × 844», у своего размера — «Custom 500 × 300». */
export function describeDevice(screen: Pick<CanvasScreen, 'device' | 'width' | 'height'>): string {
  const name = screen.device === 'custom' ? 'Custom' : SCREEN_DEVICES[screen.device].name
  return `${name} ${screen.width} × ${screen.height}`
}

/**
 * Экран на холсте: подпись над ним, рамка устройства и сам HTML в iframe. Поверх iframe лежит
 * прозрачный слой: человек не нажимает кнопки дизайна, а двигает экран и открывает «Fix».
 */
export const ScreenFrame = memo(function ScreenFrame({
  canvasId,
  screen,
  position,
  selected,
  dragging,
  previewVersionId,
  onPointerDown,
  onSelect
}: ScreenFrameProps) {
  const [renaming, setRenaming] = useState(false)
  const frame = screenFrame(screen)
  const insets = FRAME_INSETS[frame]
  const frameWidth = screen.width + insets.left + insets.right
  const style = {
    transform: `translate(${position.x}px, ${position.y}px)`,
    width: frameWidth,
    height: screen.height + insets.top + insets.bottom,
    '--frame-width': frameWidth,
    '--frame-top': `${insets.top}px`,
    '--frame-side': `${insets.left}px`
  } as CSSProperties

  const rename = (name: string) => {
    setRenaming(false)
    void window.atox.canvas.renameScreen(canvasId, screen.id, name.slice(0, CANVAS_NAME_MAX_LENGTH))
  }

  return (
    <div
      className="canvas-screen"
      data-screen-id={screen.id}
      data-frame={frame}
      data-selected={selected}
      data-dragging={dragging}
      style={style}
    >
      <div className="canvas-screen__label">
        {renaming ? (
          <InlineRename
            value={screen.name}
            label="Screen name"
            onSubmit={rename}
            onCancel={() => setRenaming(false)}
          />
        ) : (
          <span
            className="canvas-screen__name"
            title="Double-click to rename"
            onDoubleClick={() => setRenaming(true)}
          >
            {screen.name}
          </span>
        )}
        <span className="canvas-screen__device">{describeDevice(screen)}</span>
        {screen.missing && (
          <span className="canvas-screen__note">
            <TriangleAlert className="icon" aria-hidden />
            File not found, showing the last saved version
          </span>
        )}
        {previewVersionId && <span className="canvas-screen__tag">Older version</span>}
      </div>
      <div className="canvas-screen__device-frame">
        <DeviceChrome frame={frame} file={screen.file} />
        <iframe
          className="canvas-screen__content"
          title={screen.name}
          sandbox="allow-scripts"
          tabIndex={-1}
          src={canvasScreenUrl(canvasId, screen.id, screen.revision, previewVersionId ?? undefined)}
          style={{ width: screen.width, height: screen.height }}
        />
        {frame === 'phone' && <span className="canvas-screen__island" aria-hidden />}
      </div>
      <button
        type="button"
        className="canvas-screen__overlay"
        aria-label={`Fix ${screen.name}`}
        aria-expanded={selected}
        onPointerDown={(event) => onPointerDown(screen.id, event)}
        // Клик мышью уже обработан протяжкой; здесь — Enter и пробел (у них `detail` равен 0).
        onClick={(event) => event.detail === 0 && onSelect(screen.id)}
      />
      {selected && <div className="canvas-screen__ring" aria-hidden />}
    </div>
  )
})

/** Полоса окна или браузера над экраном: кнопки светофора и адрес. */
function DeviceChrome({ frame, file }: { frame: FrameKind; file: string }) {
  if (frame !== 'window' && frame !== 'browser') {
    return null
  }
  return (
    <div className="canvas-screen__chrome" aria-hidden>
      <span className="canvas-screen__lights">
        <i />
        <i />
        <i />
      </span>
      {frame === 'browser' && (
        <span className="canvas-screen__address">{file.split(/[\\/]/).pop()}</span>
      )}
    </div>
  )
}
