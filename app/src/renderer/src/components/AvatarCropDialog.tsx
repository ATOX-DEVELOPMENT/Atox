import { useEffect, useRef, useState, type PointerEvent, type WheelEvent } from 'react'
import { X } from 'lucide-react'
import { PROFILE_AVATAR } from '../../../shared/settings'
import {
  AVATAR_ZOOM,
  clampCrop,
  coverScale,
  INITIAL_CROP,
  renderCrop,
  zoomCrop,
  type AvatarCrop,
  type ImageSize
} from '../lib/avatarCrop'

/** Сторона окна с фото в пикселях: круг вписан в него. */
const VIEW = 280

/** Шаг колёсика и трекпада: чем больше прокрутка, тем сильнее приближение. */
const WHEEL_SENSITIVITY = 0.002

interface AvatarCropDialogProps {
  file: File
  onSave(avatar: string): void
  onClose(): void
}

interface Loaded {
  element: HTMLImageElement
  size: ImageSize
}

/**
 * Окно выбора кадра для аватарки: фото двигают мышью и приближают колёсиком или ползунком,
 * внутри круга остаётся то, что попадёт в аватарку.
 */
export function AvatarCropDialog({ file, onSave, onClose }: AvatarCropDialogProps) {
  const [loaded, setLoaded] = useState<Loaded | null>(null)
  const [failed, setFailed] = useState(false)
  const [crop, setCrop] = useState<AvatarCrop>(INITIAL_CROP)
  const drag = useRef<{ x: number; y: number } | null>(null)

  useEffect(() => {
    // Не blob: URL: политика безопасности окна пропускает картинки только из data:.
    const reader = new FileReader()
    reader.onload = () => {
      const element = new Image()
      element.onload = () => {
        setLoaded({ element, size: { width: element.naturalWidth, height: element.naturalHeight } })
      }
      element.onerror = () => setFailed(true)
      element.src = String(reader.result)
    }
    reader.onerror = () => setFailed(true)
    reader.readAsDataURL(file)
    return () => {
      reader.onload = null
    }
  }, [file])

  useEffect(() => {
    const closeOnEscape = (event: globalThis.KeyboardEvent) => {
      if (event.key === 'Escape') {
        event.preventDefault()
        onClose()
      }
    }
    window.addEventListener('keydown', closeOnEscape)
    return () => window.removeEventListener('keydown', closeOnEscape)
  }, [onClose])

  const startDrag = (event: PointerEvent<HTMLDivElement>) => {
    event.currentTarget.setPointerCapture(event.pointerId)
    drag.current = { x: event.clientX, y: event.clientY }
  }

  const moveDrag = (event: PointerEvent<HTMLDivElement>) => {
    const from = drag.current
    if (!from || !loaded) {
      return
    }
    drag.current = { x: event.clientX, y: event.clientY }
    const dx = event.clientX - from.x
    const dy = event.clientY - from.y
    setCrop((current) =>
      clampCrop({ ...current, x: current.x + dx, y: current.y + dy }, loaded.size, VIEW)
    )
  }

  const zoomAt = (zoom: number, anchor = { x: 0, y: 0 }) => {
    if (loaded) {
      setCrop((current) => zoomCrop(current, zoom, anchor, loaded.size, VIEW))
    }
  }

  const wheelZoom = (event: WheelEvent<HTMLDivElement>) => {
    const bounds = event.currentTarget.getBoundingClientRect()
    zoomAt(crop.zoom * (1 - event.deltaY * WHEEL_SENSITIVITY), {
      x: event.clientX - bounds.left - VIEW / 2,
      y: event.clientY - bounds.top - VIEW / 2
    })
  }

  const save = () => {
    if (loaded) {
      onSave(renderCrop(loaded.element, loaded.size, crop, VIEW, PROFILE_AVATAR))
    }
  }

  const scale = loaded ? coverScale(loaded.size, VIEW, crop.zoom) : 1

  return (
    <div className="modal" role="presentation" onMouseDown={onClose}>
      <div
        className="modal__dialog avatar-crop"
        role="dialog"
        aria-modal="true"
        aria-labelledby="avatar-crop-title"
        onMouseDown={(event) => event.stopPropagation()}
      >
        <header className="modal__header">
          <div>
            <h2 id="avatar-crop-title" className="modal__title">
              Profile photo
            </h2>
            <p className="modal__subtitle">Drag to move, scroll to zoom.</p>
          </div>
          <button type="button" className="icon-button" aria-label="Close" onClick={onClose}>
            <X className="icon" />
          </button>
        </header>

        <div className="avatar-crop__body">
          <div
            className="avatar-crop__view"
            style={{ width: VIEW, height: VIEW }}
            onPointerDown={startDrag}
            onPointerMove={moveDrag}
            onPointerUp={() => (drag.current = null)}
            onPointerCancel={() => (drag.current = null)}
            onWheel={wheelZoom}
          >
            {loaded && (
              <img
                className="avatar-crop__image"
                src={loaded.element.src}
                alt=""
                draggable={false}
                style={{
                  width: loaded.size.width,
                  height: loaded.size.height,
                  transform: `translate(calc(-50% + ${crop.x}px), calc(-50% + ${crop.y}px)) scale(${scale})`
                }}
              />
            )}
            {failed && <p className="avatar-crop__error">Could not open this image.</p>}
            <span className="avatar-crop__mask" aria-hidden />
          </div>
          <input
            type="range"
            className="avatar-crop__zoom"
            aria-label="Zoom"
            min={AVATAR_ZOOM.min}
            max={AVATAR_ZOOM.max}
            step={0.01}
            value={crop.zoom}
            disabled={!loaded}
            onChange={(event) => zoomAt(Number(event.target.value))}
          />
        </div>

        <footer className="modal__footer">
          <button type="button" className="settings__button" onClick={onClose}>
            Cancel
          </button>
          <button
            type="button"
            className="settings__button settings__button--primary"
            disabled={!loaded}
            onClick={save}
          >
            Save
          </button>
        </footer>
      </div>
    </div>
  )
}
