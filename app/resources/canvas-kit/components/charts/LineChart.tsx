import { useId } from 'react'
import { cn } from '../../lib/cn'
import { ChartFrame } from './Frame'
import { Legend } from './Legend'
import { seriesColor, smoothPath, toPoints } from './geometry'

export interface LineSeries {
  name: string
  data: number[]
  /** Свой цвет серии (CSS); по умолчанию из палитры графиков по порядку. */
  color?: string
  /** Пунктир: прогноз, прошлый период. */
  dashed?: boolean
}

export interface LineChartProps {
  /** Одна серия как простой массив или несколько именованных. */
  data?: number[]
  series?: LineSeries[]
  /** Подписи по X, по одной на точку. */
  labels?: string[]
  height?: number
  /** Мягкая заливка под линиями. */
  area?: boolean
  format?: (value: number) => string
  /** Подсветить точку с этим индексом (по умолчанию последнюю). */
  highlight?: number | null
  className?: string
}

const WIDTH = 1000

/** Линейный график с гладкими кривыми; несколько серий получают легенду. */
export function LineChart({
  data,
  series,
  labels,
  height = 220,
  area = false,
  format,
  highlight,
  className
}: LineChartProps) {
  const gradient = useId()
  const lines: LineSeries[] = series ?? [{ name: 'Value', data: data ?? [] }]
  const max = Math.max(...lines.flatMap((line) => line.data), 0)
  const length = Math.max(...lines.map((line) => line.data.length))
  const marker = highlight === undefined ? length - 1 : highlight
  // Точки в процентах от области построения: от краёв до центров подписей X.
  const inset = labels && length > 0 ? 50 / length : 0
  return (
    <figure className={cn('grid gap-4', className)}>
      {lines.length > 1 && (
        <Legend items={lines.map((line, index) => ({ label: line.name, color: line.color ?? seriesColor[index % seriesColor.length] }))} />
      )}
      <ChartFrame max={max} labels={labels} height={height} format={format}>
        {(top) => (
          <div className="absolute inset-y-0" style={{ left: `${inset}%`, right: `${inset}%` }}>
            <svg viewBox={`0 0 ${WIDTH} ${height}`} preserveAspectRatio="none" className="absolute inset-0 size-full overflow-visible">
              {lines.map((line, index) => {
                const color = line.color ?? seriesColor[index % seriesColor.length]
                const points = toPoints(line.data, WIDTH, height, 0, top)
                const path = smoothPath(points)
                return (
                  <g key={line.name}>
                    {area && (
                      <>
                        <defs>
                          <linearGradient id={`${gradient}-${index}`} x1="0" x2="0" y1="0" y2="1">
                            <stop offset="0%" stopColor={color} stopOpacity={index === 0 ? 0.2 : 0.1} />
                            <stop offset="100%" stopColor={color} stopOpacity="0" />
                          </linearGradient>
                        </defs>
                        <path d={`${path} L${WIDTH},${height} L0,${height} Z`} fill={`url(#${gradient}-${index})`} />
                      </>
                    )}
                    <path
                      d={path}
                      fill="none"
                      stroke={color}
                      strokeWidth="2"
                      strokeDasharray={line.dashed ? '4 4' : undefined}
                      strokeLinecap="round"
                      strokeLinejoin="round"
                      vectorEffect="non-scaling-stroke"
                    />
                  </g>
                )
              })}
            </svg>
            {marker !== null &&
              lines.map((line, index) => {
                const value = line.data[marker]
                if (value === undefined) return null
                const color = line.color ?? seriesColor[index % seriesColor.length]
                return (
                  <span
                    key={line.name}
                    aria-hidden
                    className="absolute size-2.5 -translate-x-1/2 -translate-y-1/2 rounded-full ring-2 ring-surface"
                    style={{
                      left: `${length > 1 ? (marker / (length - 1)) * 100 : 0}%`,
                      top: `${100 - (value / top) * 100}%`,
                      background: color
                    }}
                  />
                )
              })}
          </div>
        )}
      </ChartFrame>
    </figure>
  )
}

/** Тот же LineChart с заливкой под линиями. */
export function AreaChart(props: LineChartProps) {
  return <LineChart area {...props} />
}
