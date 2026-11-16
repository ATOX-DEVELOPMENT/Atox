import { useId } from 'react'
import { cn } from '../../lib/cn'
import { smoothPath, toPoints, toneColor, type ChartTone } from './geometry'

export interface SparklineProps {
  data: number[]
  tone?: ChartTone
  /** Мягкая заливка под линией. */
  area?: boolean
  /** Размер задаётся классами: "h-8 w-24"; по ширине тянется. */
  className?: string
}

/** Маленький график тренда без осей: в метриках, строках таблиц и списках. */
export function Sparkline({ data, tone = 'accent', area = true, className }: SparklineProps) {
  const gradient = useId()
  const width = 100
  const height = 32
  const points = toPoints(data, width, height - 2, Math.min(...data), Math.max(...data)).map((p) => ({
    x: p.x,
    y: p.y + 1
  }))
  const line = smoothPath(points)
  const color = toneColor[tone]
  return (
    <svg
      aria-hidden
      viewBox={`0 0 ${width} ${height}`}
      preserveAspectRatio="none"
      className={cn('block h-8 w-full overflow-visible', className)}
    >
      {area && (
        <>
          <defs>
            <linearGradient id={gradient} x1="0" x2="0" y1="0" y2="1">
              <stop offset="0%" stopColor={color} stopOpacity="0.22" />
              <stop offset="100%" stopColor={color} stopOpacity="0" />
            </linearGradient>
          </defs>
          <path d={`${line} L${width},${height} L0,${height} Z`} fill={`url(#${gradient})`} />
        </>
      )}
      <path
        d={line}
        fill="none"
        stroke={color}
        strokeWidth="1.75"
        strokeLinecap="round"
        strokeLinejoin="round"
        vectorEffect="non-scaling-stroke"
      />
    </svg>
  )
}
