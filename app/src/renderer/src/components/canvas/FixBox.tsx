import { useCallback, useEffect, useLayoutEffect, useRef } from 'react'
import { placeBeside, toViewport, withLabel, type Rect } from '../../lib/canvasView'
import { RequestBox } from './RequestBox'
import type { ViewState } from './viewState'

/** Зазор между экраном и окном «Fix» и отступ окна от краёв холста, в пикселях окна. */
const FIX_BOX_GAP = 16
const FIX_BOX_MARGIN = 12

interface FixBoxProps {
  viewState: ViewState
  screenId: string
  screenName: string
  /** Ошибка сборки экрана; `null` — сборка в порядке. */
  buildError: string | null
  /** Экран в координатах холста — вместе с рамкой устройства. */
  target: Rect
  /** Остальные экраны: окно старается их не закрывать. */
  obstacles: readonly Rect[]
  chatTitle: string
  onSend(text: string): Promise<void>
  onClose(): void
}

/**
 * «Fix» у выбранного экрана. Стоит в пикселях окна, а не холста: при любом масштабе оно
 * одного размера и не выходит за края. Клик мимо окна и мимо его экрана закрывает его.
 */
export function FixBox({
  viewState,
  screenId,
  screenName,
  buildError,
  target,
  obstacles,
  chatTitle,
  onSend,
  onClose
}: FixBoxProps) {
  const boxRef = useRef<HTMLDivElement>(null)

  const place = useCallback(() => {
    const box = boxRef.current
    const view = viewState.view()
    if (!box || !view) {
      return
    }
    // Окно не должно закрывать подпись экрана: на ней может быть и «Build error».
    const position = placeBeside(
      toViewport(view, withLabel(target)),
      { width: box.offsetWidth, height: box.offsetHeight },
      viewState.viewport(),
      obstacles.map((rect) => toViewport(view, rect)),
      FIX_BOX_GAP,
      FIX_BOX_MARGIN
    )
    box.style.transform = `translate(${position.x}px, ${position.y}px)`
  }, [viewState, target, obstacles])

  useLayoutEffect(() => {
    place()
    return viewState.subscribe(place)
  }, [place, viewState])

  useEffect(() => {
    const closeOutside = (event: PointerEvent) => {
      if (!(event.target instanceof Element) || boxRef.current?.contains(event.target)) {
        return
      }
      const screen = event.target.closest<HTMLElement>('[data-screen-id]')
      if (screen?.dataset.screenId !== screenId) {
        onClose()
      }
    }
    document.addEventListener('pointerdown', closeOutside, true)
    return () => document.removeEventListener('pointerdown', closeOutside, true)
  }, [screenId, onClose])

  return (
    <div className="fix-box" data-canvas-ui>
      <RequestBox
        ref={boxRef}
        title="Fix"
        subtitle={`Screen: ${screenName}`}
        context={[`screen: ${screenName}`, 'screenshot']}
        placeholder="What should change on this screen?"
        notice={buildError}
        chatTitle={chatTitle}
        onSend={onSend}
        onClose={onClose}
      />
    </div>
  )
}
