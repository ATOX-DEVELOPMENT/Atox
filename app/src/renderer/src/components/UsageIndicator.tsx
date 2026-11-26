import type { ConversationUsage } from '../../../shared/conversation'
import { formatTokens } from '../lib/conversationText'

/** Размер кольца в единицах viewBox: радиус и толщина линии. */
const RING = { size: 20, radius: 8, stroke: 2.5 } as const
const CIRCUMFERENCE = 2 * Math.PI * RING.radius

/** С какой заполненности контекста кольцо предупреждает, что скоро понадобится сжатие. */
const CONTEXT_WARNING_PERCENT = 80

interface UsageIndicatorProps {
  usage: ConversationUsage
  /** Открывает разбор контекста, как `/context`; нет — агент его не сообщает, кольцо не нажать. */
  onOpen?: () => void
}

/** Кольцо заполненности контекста в поле ввода; точные числа — в подсказке, клик — разбор. */
export function UsageIndicator({ usage: { context }, onOpen }: UsageIndicatorProps) {
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

  return onOpen ? (
    <button
      type="button"
      className="usage-indicator"
      title={`${title} — show what fills it`}
      aria-label={`${title}. Show what fills the context`}
      data-warning={warning}
      onClick={onOpen}
    >
      {ring}
    </button>
  ) : (
    <div className="usage-indicator" title={title} aria-label={title} role="img" data-warning={warning}>
      {ring}
    </div>
  )
}
