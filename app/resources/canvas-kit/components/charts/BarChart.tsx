import { cn } from '../../lib/cn'
import { ChartFrame } from './Frame'
import { toneColor, type ChartTone } from './geometry'

export interface BarDatum {
  label: string
  value: number
}

export interface BarChartProps {
  /** Значения или пары подпись/значение. */
  data: Array<number | BarDatum>
  /** Подписи по X, если data задана числами. */
  labels?: string[]
  height?: number
  tone?: ChartTone
  /** Выделить один столбец, остальные приглушить. */
  highlight?: number
  format?: (value: number) => string
  className?: string
}

/** Столбчатая диаграмма: столбцы тянутся по ширине контейнера. */
export function BarChart({
  data,
  labels,
  height = 220,
  tone = 'accent',
  highlight,
  format,
  className
}: BarChartProps) {
  const items = data.map((item, index) =>
    typeof item === 'number' ? { label: labels?.[index] ?? '', value: item } : item
  )
  const values = items.map((item) => item.value)
  const axisLabels = items.some((item) => item.label) ? items.map((item) => item.label) : undefined
  const color = toneColor[tone]
  return (
    <figure className={className}>
      <ChartFrame max={Math.max(...values, 0)} labels={axisLabels} height={height} format={format}>
        {(top) => (
          <div className="absolute inset-0 flex items-end">
            {items.map((item, index) => (
              <div key={`${item.label}-${index}`} className="flex h-full flex-1 items-end justify-center px-[18%]">
                <div
                  title={`${item.label}: ${item.value}`}
                  className={cn('w-full max-w-10 rounded-t-[4px] transition-opacity')}
                  style={{
                    height: `${(item.value / top) * 100}%`,
                    background: color,
                    opacity: highlight === undefined || highlight === index ? 1 : 0.3
                  }}
                />
              </div>
            ))}
          </div>
        )}
      </ChartFrame>
    </figure>
  )
}
