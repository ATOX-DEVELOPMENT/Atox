import type { ReactNode } from 'react'
import { cn } from '../lib/cn'
import { fillTone, type Tone } from '../lib/tokens'

export interface ProgressProps {
  value: number
  max?: number
  tone?: Tone
  size?: 'sm' | 'md'
  label?: ReactNode
  /** Показать процент справа от подписи. */
  showValue?: boolean
  className?: string
}

/** Полоса прогресса с подписью и значением. */
export function Progress({
  value,
  max = 100,
  tone = 'accent',
  size = 'sm',
  label,
  showValue,
  className
}: ProgressProps) {
  const percent = Math.min(100, Math.max(0, (value / max) * 100))
  return (
    <div className={cn('grid gap-2', className)}>
      {(label || showValue) && (
        <div className="flex items-center justify-between gap-3 text-sm">
          {label && <span className="text-fg">{label}</span>}
          {showValue && <span className="text-fg-muted tabular-nums">{Math.round(percent)}%</span>}
        </div>
      )}
      <div
        role="progressbar"
        aria-valuemin={0}
        aria-valuemax={max}
        aria-valuenow={value}
        className={cn('w-full overflow-hidden rounded-full bg-muted-strong', size === 'sm' ? 'h-1.5' : 'h-2.5')}
      >
        <div className={cn('h-full rounded-full', fillTone[tone])} style={{ width: `${percent}%` }} />
      </div>
    </div>
  )
}
