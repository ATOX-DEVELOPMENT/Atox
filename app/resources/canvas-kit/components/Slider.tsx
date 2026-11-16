import type { KeyboardEvent } from 'react'
import { cn } from '../lib/cn'
import { focusRing } from '../lib/tokens'
import { useControllable } from '../lib/useControllable'

export interface SliderProps {
  value?: number
  defaultValue?: number
  onChange?: (value: number) => void
  min?: number
  max?: number
  step?: number
  label?: string
  /** Показать значение справа от подписи. */
  showValue?: boolean
  format?: (value: number) => string
  disabled?: boolean
  className?: string
}

/** Ползунок: трек, заливка до значения и ручка; стрелки клавиатуры меняют значение. */
export function Slider({
  value,
  defaultValue = 50,
  onChange,
  min = 0,
  max = 100,
  step = 1,
  label,
  showValue = false,
  format = String,
  disabled,
  className
}: SliderProps) {
  const [current, setCurrent] = useControllable(value, defaultValue, onChange)
  const percent = ((current - min) / (max - min)) * 100
  const clamp = (next: number) => Math.min(max, Math.max(min, next))

  const onKeyDown = (event: KeyboardEvent<HTMLDivElement>) => {
    const delta = { ArrowRight: step, ArrowUp: step, ArrowLeft: -step, ArrowDown: -step }[event.key]
    if (delta === undefined) return
    event.preventDefault()
    setCurrent(clamp(current + delta))
  }

  return (
    <div className={cn('grid gap-2', disabled && 'pointer-events-none opacity-50', className)}>
      {(label || showValue) && (
        <div className="flex items-center justify-between text-sm">
          {label && <span className="font-semibold text-fg">{label}</span>}
          {showValue && <span className="text-fg-muted tabular-nums">{format(current)}</span>}
        </div>
      )}
      <div
        role="slider"
        tabIndex={disabled ? -1 : 0}
        aria-label={label}
        aria-valuemin={min}
        aria-valuemax={max}
        aria-valuenow={current}
        aria-valuetext={format(current)}
        onKeyDown={onKeyDown}
        className={cn('group relative flex h-5 cursor-pointer items-center rounded-full', focusRing)}
      >
        <div className="h-1.5 w-full overflow-hidden rounded-full bg-muted-strong">
          <div className="h-full rounded-full bg-accent" style={{ width: `${percent}%` }} />
        </div>
        <span
          className="absolute size-[18px] -translate-x-1/2 rounded-full border border-border bg-white shadow-sm"
          style={{ left: `${percent}%` }}
        />
      </div>
    </div>
  )
}
