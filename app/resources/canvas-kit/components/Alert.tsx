import type { ReactNode } from 'react'
import type { LucideIcon } from 'lucide-react'
import { CircleAlert, CircleCheck, Info, TriangleAlert, X } from 'lucide-react'
import { cn } from '../lib/cn'
import { focusRing, textTone, type Tone } from '../lib/tokens'

export type StatusTone = Exclude<Tone, 'accent'>

/** Иконка по умолчанию для каждого статуса. */
export const statusIcon: Record<StatusTone, LucideIcon> = {
  neutral: Info,
  info: Info,
  success: CircleCheck,
  warning: TriangleAlert,
  danger: CircleAlert
}

const surfaceTone: Record<StatusTone, string> = {
  neutral: 'bg-muted border-border',
  info: 'bg-info/6 border-info/20',
  success: 'bg-success/6 border-success/20',
  warning: 'bg-warning/8 border-warning/25',
  danger: 'bg-danger/6 border-danger/20'
}

export interface AlertProps {
  tone?: StatusTone
  title?: ReactNode
  children?: ReactNode
  icon?: LucideIcon
  /** Ссылка или кнопка справа. */
  action?: ReactNode
  onDismiss?: () => void
  /** banner: полоса во всю ширину вверху страницы, без скругления. */
  layout?: 'inline' | 'banner'
  className?: string
}

/** Уведомление в потоке страницы или баннер во всю ширину. */
export function Alert({
  tone = 'info',
  title,
  children,
  icon,
  action,
  onDismiss,
  layout = 'inline',
  className
}: AlertProps) {
  const Glyph = icon ?? statusIcon[tone]
  const banner = layout === 'banner'
  return (
    <div
      role={tone === 'danger' || tone === 'warning' ? 'alert' : 'status'}
      className={cn(
        'flex gap-3 border text-sm',
        surfaceTone[tone],
        banner ? 'items-center border-x-0 border-t-0 px-4 py-2.5' : 'items-start rounded-lg p-3.5',
        className
      )}
    >
      <Glyph aria-hidden size={16} strokeWidth={1.75} className={cn('shrink-0', !banner && 'mt-0.5', textTone[tone])} />
      <div className={cn('min-w-0 flex-1', banner ? 'flex flex-wrap items-center gap-x-2' : 'grid gap-0.5')}>
        {title && <p className="font-semibold text-fg">{title}</p>}
        {children && <div className="text-fg-muted">{children}</div>}
      </div>
      {action && <div className="flex shrink-0 items-center">{action}</div>}
      {onDismiss && (
        <button
          type="button"
          aria-label="Dismiss"
          onClick={onDismiss}
          className={cn('-m-1 grid size-6 shrink-0 cursor-pointer place-items-center rounded text-fg-subtle hover:text-fg', focusRing)}
        >
          <X aria-hidden size={14} strokeWidth={2} />
        </button>
      )}
    </div>
  )
}
