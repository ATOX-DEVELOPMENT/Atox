import type { ReactNode } from 'react'
import { formatCompact } from '../../lib/format'
import { niceTicks } from './geometry'

export interface ChartFrameProps {
  /** Максимум данных: по нему строятся деления оси. */
  max: number
  labels?: string[]
  height: number
  format?: (value: number) => string
  /** Сколько подписей по X показать при длинных рядах. */
  maxLabels?: number
  /** Область построения; получает верх шкалы. */
  children: (top: number) => ReactNode
}

/** Общая рамка графиков: ось Y с делениями, сетка и подписи по X. */
export function ChartFrame({
  max,
  labels,
  height,
  format = formatCompact,
  maxLabels = 8,
  children
}: ChartFrameProps) {
  const ticks = niceTicks(max)
  const top = ticks[ticks.length - 1]
  const every = labels ? Math.max(1, Math.ceil(labels.length / maxLabels)) : 1
  return (
    <div className="grid grid-cols-[auto_1fr] gap-x-3 text-2xs text-fg-subtle tabular-nums">
      <div className="relative w-8" style={{ height }}>
        {ticks.map((tick) => (
          <span
            key={tick}
            className="absolute right-0 -translate-y-1/2 leading-none"
            style={{ top: `${100 - (tick / top) * 100}%` }}
          >
            {format(tick)}
          </span>
        ))}
      </div>
      <div className="relative" style={{ height }}>
        {ticks.map((tick) => (
          <span
            key={tick}
            aria-hidden
            className={tick === 0 ? 'absolute inset-x-0 border-t border-border-strong' : 'absolute inset-x-0 border-t border-dashed border-border'}
            style={{ top: `${100 - (tick / top) * 100}%` }}
          />
        ))}
        {children(top)}
      </div>
      {labels && (
        <>
          <span />
          <div className="relative mt-2 flex h-4">
            {labels.map((label, index) => (
              <span key={`${label}-${index}`} className="flex-1 text-center whitespace-nowrap">
                {index % every === 0 ? label : ''}
              </span>
            ))}
          </div>
        </>
      )}
    </div>
  )
}
