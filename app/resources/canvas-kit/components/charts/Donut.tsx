import type { ReactNode } from 'react'
import { cn } from '../../lib/cn'
import { Legend } from './Legend'
import { seriesColor } from './geometry'

export interface DonutDatum {
  label: string
  value: number
  color?: string
}

export interface DonutProps {
  data: DonutDatum[]
  /** Диаметр в пикселях. */
  size?: number
  thickness?: number
  /** Крупное значение в центре и подпись под ним. */
  centerValue?: ReactNode
  centerLabel?: ReactNode
  legend?: 'right' | 'bottom' | 'none'
  format?: (value: number) => string
  className?: string
}

/** Кольцевая диаграмма долей с зазорами между сегментами и легендой. */
export function Donut({
  data,
  size = 160,
  thickness = 14,
  centerValue,
  centerLabel,
  legend = 'right',
  format = (value) => value.toLocaleString('en-US'),
  className
}: DonutProps) {
  const total = data.reduce((sum, item) => sum + item.value, 0) || 1
  const radius = 50 - (thickness / size) * 50
  const stroke = (thickness / size) * 100
  const gap = data.length > 1 ? 0.6 : 0
  let offset = 0
  return (
    <figure
      className={cn(
        'flex gap-6',
        legend === 'bottom' ? 'flex-col items-center' : 'items-center',
        className
      )}
    >
      <div className="relative shrink-0" style={{ width: size, height: size }}>
        <svg viewBox="0 0 100 100" className="size-full -rotate-90">
          <circle cx="50" cy="50" r={radius} fill="none" stroke="var(--color-muted)" strokeWidth={stroke} />
          {data.map((item, index) => {
            const share = (item.value / total) * 100
            const dash = Math.max(share - gap, 0)
            const segment = (
              <circle
                key={item.label}
                cx="50"
                cy="50"
                r={radius}
                fill="none"
                pathLength={100}
                stroke={item.color ?? seriesColor[index % seriesColor.length]}
                strokeWidth={stroke}
                strokeDasharray={`${dash} ${100 - dash}`}
                strokeDashoffset={-offset}
              />
            )
            offset += share
            return segment
          })}
        </svg>
        {(centerValue || centerLabel) && (
          <div className="absolute inset-0 grid place-content-center text-center">
            {centerValue && <span className="text-xl font-semibold text-fg tabular-nums">{centerValue}</span>}
            {centerLabel && <span className="text-xs text-fg-muted">{centerLabel}</span>}
          </div>
        )}
      </div>
      {legend !== 'none' && (
        <Legend
          className={legend === 'right' ? 'grid gap-2' : 'justify-center'}
          items={data.map((item, index) => ({
            label: item.label,
            color: item.color ?? seriesColor[index % seriesColor.length],
            value: legend === 'right' ? format(item.value) : undefined
          }))}
        />
      )}
    </figure>
  )
}
