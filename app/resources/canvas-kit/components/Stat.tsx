import type { ReactNode } from 'react'
import type { LucideIcon } from 'lucide-react'
import { ArrowDownRight, ArrowUpRight } from 'lucide-react'
import { cn } from '../lib/cn'
import { Card } from './Card'
import { Sparkline } from './charts/Sparkline'

export interface StatProps {
  label: string
  /** Уже отформатированное значение: "$48,920", "2.4k", "98.2%". */
  value: ReactNode
  /** Изменение в процентах: знак задаёт стрелку и цвет. */
  delta?: number
  /** Рост это плохо (отток, ошибки): цвета меняются местами. */
  invertDelta?: boolean
  /** Пояснение к изменению: "vs last week". */
  hint?: string
  icon?: LucideIcon
  /** Ряд значений для спарклайна внизу. */
  trend?: number[]
  /** Без собственной карточки: для полос метрик внутри одной карточки. */
  bare?: boolean
  className?: string
}

/** Метрика: подпись, крупное число, изменение и необязательный спарклайн. */
export function Stat({
  label,
  value,
  delta,
  invertDelta,
  hint,
  icon: Glyph,
  trend,
  bare,
  className
}: StatProps) {
  const good = delta === undefined || (invertDelta ? delta <= 0 : delta >= 0)
  const Arrow = delta !== undefined && delta < 0 ? ArrowDownRight : ArrowUpRight
  const body = (
    <div className="grid gap-3">
      <div className="flex items-center justify-between gap-3">
        <span className="text-sm text-fg-muted">{label}</span>
        {Glyph && <Glyph aria-hidden size={16} strokeWidth={1.75} className="text-fg-subtle" />}
      </div>
      <div className="flex items-end justify-between gap-4">
        <div className="grid gap-1.5">
          <span className="text-2xl font-semibold tracking-tight text-fg tabular-nums">{value}</span>
          {(delta !== undefined || hint) && (
            <span className="flex items-center gap-1.5 text-xs">
              {delta !== undefined && (
                <span
                  className={cn(
                    'inline-flex items-center gap-0.5 font-semibold tabular-nums',
                    good ? 'text-success-text' : 'text-danger-text'
                  )}
                >
                  <Arrow aria-hidden size={14} strokeWidth={2} />
                  {Math.abs(delta).toFixed(1).replace(/\.0$/, '')}%
                </span>
              )}
              {hint && <span className="text-fg-subtle">{hint}</span>}
            </span>
          )}
        </div>
        {trend && (
          <Sparkline
            data={trend}
            tone={good ? 'accent' : 'danger'}
            className="h-9 w-24 shrink-0"
          />
        )}
      </div>
    </div>
  )
  if (bare) return <div className={className}>{body}</div>
  return <Card className={className}>{body}</Card>
}
