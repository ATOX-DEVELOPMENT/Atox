import { useLayoutEffect, useRef, useState, type ReactNode } from 'react'
import { createPortal } from 'react-dom'

/** Отступ подсказки от кнопки и от краёв окна. */
const HINT_GAP_PX = 6

/** Где подсказка относительно кнопки: над ней (сайдбар) или под ней (кнопки у верха окна). */
export type HintPlacement = 'above' | 'below'

/** Подсказка кнопки при наведении: прямоугольник кнопки, у которой её показать. */
export function useHoverHint() {
  const [anchor, setAnchor] = useState<DOMRect | null>(null)
  return {
    anchor,
    show: (element: HTMLElement) => setAnchor(element.getBoundingClientRect()),
    hide: () => setAnchor(null)
  }
}

interface HoverHintProps {
  anchor: DOMRect
  placement: HintPlacement
  children: ReactNode
}

/**
 * Подписи кнопок с одними иконками. Рисуется поверх окна: сайдбар и шапка обрезают всё, что
 * выходит за их края. По центру кнопки, но не дальше края окна — у кнопок в углу подсказка
 * сдвигается внутрь, а не обрезается.
 */
export function HoverHint({ anchor, placement, children }: HoverHintProps) {
  const hintRef = useRef<HTMLSpanElement>(null)
  // Ширина подсказки известна только после отрисовки: до этого она невидима.
  const [left, setLeft] = useState<number | null>(null)

  useLayoutEffect(() => {
    const hint = hintRef.current
    if (!hint) {
      return
    }
    const width = hint.offsetWidth
    const centered = anchor.left + anchor.width / 2 - width / 2
    const rightmost = window.innerWidth - HINT_GAP_PX - width
    setLeft(Math.max(HINT_GAP_PX, Math.min(centered, rightmost)))
  }, [anchor])

  const top = placement === 'above' ? anchor.top - HINT_GAP_PX : anchor.bottom + HINT_GAP_PX
  return createPortal(
    <span
      ref={hintRef}
      className="hover-hint"
      role="tooltip"
      data-placement={placement}
      style={{ left: left ?? 0, top, visibility: left === null ? 'hidden' : undefined }}
    >
      {children}
    </span>,
    document.body
  )
}
