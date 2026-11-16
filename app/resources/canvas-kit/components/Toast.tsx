import type { ReactNode } from 'react'
import type { LucideIcon } from 'lucide-react'
import { X } from 'lucide-react'
import { cn } from '../lib/cn'
import { focusRing, textTone } from '../lib/tokens'
import { statusIcon, type StatusTone } from './Alert'

export interface ToastProps {
  tone?: StatusTone
  title: ReactNode
  description?: ReactNode
  icon?: LucideIcon
  /** Короткое действие: «Undo», «View». */
  action?: ReactNode
  onDismiss?: () => void
  /** Прижать к краю экрана; bottom стоит над TabBar. Родитель relative (Screen уже такой). */
  placement?: 'inline' | 'bottom-right' | 'bottom' | 'top'
  className?: string
}

const placementClass = {
  inline: '',
  'bottom-right': 'absolute right-6 bottom-6 z-30',
  bottom: 'absolute inset-x-4 bottom-[100px] z-30 mx-auto w-auto',
  top: 'absolute inset-x-4 top-[58px] z-30 mx-auto w-auto'
} as const

/** Всплывающее уведомление, показанное в момент появления. */
export function Toast({
  tone = 'success',
  title,
  description,
  icon,
  action,
  onDismiss,
  placement = 'inline',
  className
}: ToastProps) {
  const Glyph = icon ?? statusIcon[tone]
  return (
    <div
      role="status"
      className={cn(
        'flex w-full max-w-sm items-start gap-3 rounded-xl border border-border bg-surface-raised p-3.5 shadow-lg',
        placementClass[placement],
        className
      )}
    >
      <Glyph aria-hidden size={18} strokeWidth={1.75} className={cn('mt-px shrink-0', textTone[tone])} />
      <div className="grid min-w-0 flex-1 gap-0.5 text-sm">
        <p className="font-semibold text-fg">{title}</p>
        {description && <p className="text-fg-muted">{description}</p>}
      </div>
      {action && <div className="shrink-0 text-sm">{action}</div>}
      {onDismiss && (
        <button
          type="button"
          aria-label="Dismiss"
          onClick={onDismiss}
          className={cn('-m-0.5 grid size-6 shrink-0 cursor-pointer place-items-center rounded text-fg-subtle hover:text-fg', focusRing)}
        >
          <X aria-hidden size={14} strokeWidth={2} />
        </button>
      )}
    </div>
  )
}
