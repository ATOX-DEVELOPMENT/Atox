import { useEffect, useLayoutEffect, useRef, useState } from 'react'
import { createPortal } from 'react-dom'
import type { ContextReport, ConversationUsage } from '../../../shared/conversation'
import { formatTokens } from '../lib/conversationText'
import { ipcErrorMessage } from '../lib/ipcError'
import { ContextCard } from './UsageCards'

/** Размер кольца в единицах viewBox: радиус и толщина линии. */
const RING = { size: 20, radius: 8, stroke: 2.5 } as const
const CIRCUMFERENCE = 2 * Math.PI * RING.radius

/** С какой заполненности контекста кольцо предупреждает, что скоро понадобится сжатие. */
const CONTEXT_WARNING_PERCENT = 80
/** Отступ окна разбора от кольца и от краёв окна. */
const POPOVER_GAP_PX = 8

interface UsageIndicatorProps {
  usage: ConversationUsage
  /** Читает разбор контекста, как `/context`; нет — агент его не сообщает, кольцо не нажать. */
  loadContext?: () => Promise<ContextReport>
}

/**
 * Кольцо заполненности контекста в поле ввода; точные числа — в подсказке. Клик открывает
 * над кольцом окно с разбором контекста и закрывает его; в ленту чата ничего не пишется.
 */
export function UsageIndicator({ usage: { context }, loadContext }: UsageIndicatorProps) {
  const [open, setOpen] = useState(false)
  const buttonRef = useRef<HTMLButtonElement>(null)
  const percent = Math.min(100, Math.round((context.used / context.limit) * 100))
  const title = `Context ${percent}% full · ${formatTokens(context.used)} of ${formatTokens(context.limit)} tokens`
  const ring = (
    <>
      <svg viewBox={`0 0 ${RING.size} ${RING.size}`} className="usage-indicator__ring">
        <circle
          className="usage-indicator__track"
          cx={RING.size / 2}
          cy={RING.size / 2}
          r={RING.radius}
          strokeWidth={RING.stroke}
        />
        <circle
          className="usage-indicator__fill"
          cx={RING.size / 2}
          cy={RING.size / 2}
          r={RING.radius}
          strokeWidth={RING.stroke}
          strokeDasharray={CIRCUMFERENCE}
          strokeDashoffset={CIRCUMFERENCE * (1 - percent / 100)}
        />
      </svg>
      <span className="usage-indicator__label">{percent}%</span>
    </>
  )
  const warning = percent >= CONTEXT_WARNING_PERCENT

  return loadContext ? (
    <>
      <button
        ref={buttonRef}
        type="button"
        className="usage-indicator"
        title={open ? undefined : `${title} — show what fills it`}
        aria-label={`${title}. Show what fills the context`}
        aria-expanded={open}
        data-warning={warning}
        data-open={open}
        onClick={() => setOpen((value) => !value)}
      >
        {ring}
      </button>
      {open && buttonRef.current && (
        <ContextPopover
          anchor={buttonRef.current}
          load={loadContext}
          onClose={() => setOpen(false)}
        />
      )}
    </>
  ) : (
    <div className="usage-indicator" title={title} aria-label={title} role="img" data-warning={warning}>
      {ring}
    </div>
  )
}

type Loaded = { report: ContextReport } | { error: string } | null

/**
 * Разбор контекста над кольцом. Читается заново при каждом открытии; закрывается кликом
 * по кольцу, кликом мимо и Esc.
 */
function ContextPopover({
  anchor,
  load,
  onClose
}: {
  anchor: HTMLElement
  load: () => Promise<ContextReport>
  onClose(): void
}) {
  const popoverRef = useRef<HTMLDivElement>(null)
  const [loaded, setLoaded] = useState<Loaded>(null)
  const [position, setPosition] = useState<{ left: number; top: number } | null>(null)

  useEffect(() => {
    let current = true
    load().then(
      (report) => current && setLoaded({ report }),
      (error) => current && setLoaded({ error: ipcErrorMessage(error) })
    )
    return () => {
      current = false
    }
  }, [load])

  useEffect(() => {
    const onPointerDown = (event: PointerEvent) => {
      const target = event.target as Node
      if (!popoverRef.current?.contains(target) && !anchor.contains(target)) {
        onClose()
      }
    }
    const onKeyDown = (event: KeyboardEvent) => event.key === 'Escape' && onClose()
    window.addEventListener('pointerdown', onPointerDown, true)
    window.addEventListener('keydown', onKeyDown)
    window.addEventListener('resize', onClose)
    return () => {
      window.removeEventListener('pointerdown', onPointerDown, true)
      window.removeEventListener('keydown', onKeyDown)
      window.removeEventListener('resize', onClose)
    }
  }, [anchor, onClose])

  // Над кольцом, правым краем к нему, но не за краем окна; высота меняется после загрузки.
  useLayoutEffect(() => {
    const popover = popoverRef.current
    if (!popover) {
      return
    }
    const rect = anchor.getBoundingClientRect()
    const width = popover.offsetWidth
    const rightmost = window.innerWidth - POPOVER_GAP_PX - width
    const left = Math.max(POPOVER_GAP_PX, Math.min(rect.right - width, rightmost))
    const top = Math.max(POPOVER_GAP_PX, rect.top - POPOVER_GAP_PX - popover.offsetHeight)
    setPosition({ left, top })
  }, [anchor, loaded])

  return createPortal(
    <div
      ref={popoverRef}
      className="context-popover"
      role="dialog"
      aria-label="Context"
      style={{
        left: position?.left ?? 0,
        top: position?.top ?? 0,
        visibility: position ? undefined : 'hidden'
      }}
    >
      {loaded === null ? (
        <p className="context-popover__note">Reading the context…</p>
      ) : 'error' in loaded ? (
        <p className="context-popover__note">Could not read the context. {loaded.error}</p>
      ) : (
        <ContextCard context={loaded.report} />
      )}
    </div>,
    document.body
  )
}
