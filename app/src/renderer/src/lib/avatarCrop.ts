/** Насколько можно приблизить фото: 1 — фото целиком покрывает круг, дальше — крупнее. */
export const AVATAR_ZOOM = { min: 1, max: 4 } as const

export interface AvatarCrop {
  /** Приближение относительно минимального, при котором фото закрывает весь круг. */
  zoom: number
  /** Смещение центра фото от центра круга в пикселях окна. */
  x: number
  y: number
}

export interface ImageSize {
  width: number
  height: number
}

export const INITIAL_CROP: AvatarCrop = { zoom: AVATAR_ZOOM.min, x: 0, y: 0 }

/** Во сколько раз растянуть фото, чтобы при zoom = 1 оно закрыло окно стороной `view`. */
export function coverScale(image: ImageSize, view: number, zoom: number): number {
  return (view / Math.min(image.width, image.height)) * zoom
}

/** Не даёт сдвинуть фото так, чтобы из-под круга показалась пустота. */
export function clampCrop(crop: AvatarCrop, image: ImageSize, view: number): AvatarCrop {
  const zoom = Math.min(AVATAR_ZOOM.max, Math.max(AVATAR_ZOOM.min, crop.zoom))
  const scale = coverScale(image, view, zoom)
  const limitX = Math.max(0, (image.width * scale - view) / 2)
  const limitY = Math.max(0, (image.height * scale - view) / 2)
  return {
    zoom,
    x: Math.min(limitX, Math.max(-limitX, crop.x)),
    y: Math.min(limitY, Math.max(-limitY, crop.y))
  }
}

/**
 * Приближает так, чтобы точка под курсором осталась на месте. `anchor` — позиция курсора
 * относительно центра окна.
 */
export function zoomCrop(
  crop: AvatarCrop,
  zoom: number,
  anchor: { x: number; y: number },
  image: ImageSize,
  view: number
): AvatarCrop {
  const next = clampCrop({ ...crop, zoom }, image, view).zoom
  const ratio = next / crop.zoom
  return clampCrop(
    {
      zoom: next,
      x: anchor.x - (anchor.x - crop.x) * ratio,
      y: anchor.y - (anchor.y - crop.y) * ratio
    },
    image,
    view
  )
}

/** Рисует то, что видно в круге, в квадрат `size`×`size` и отдаёт как data URL. */
export function renderCrop(
  source: CanvasImageSource,
  image: ImageSize,
  crop: AvatarCrop,
  view: number,
  output: { size: number; mimeType: string; quality: number }
): string {
  const canvas = document.createElement('canvas')
  canvas.width = output.size
  canvas.height = output.size
  const context = canvas.getContext('2d')
  if (!context) {
    throw new Error('Canvas is unavailable')
  }
  // Окно и холст — квадраты, поэтому одного множителя достаточно.
  const factor = output.size / view
  const scale = coverScale(image, view, crop.zoom) * factor
  const width = image.width * scale
  const height = image.height * scale
  // JPEG не хранит прозрачность: без подложки прозрачные места фото стали бы чёрными.
  context.fillStyle = '#fff'
  context.fillRect(0, 0, output.size, output.size)
  context.imageSmoothingQuality = 'high'
  context.drawImage(
    source,
    (output.size - width) / 2 + crop.x * factor,
    (output.size - height) / 2 + crop.y * factor,
    width,
    height
  )
  return canvas.toDataURL(output.mimeType, output.quality)
}
