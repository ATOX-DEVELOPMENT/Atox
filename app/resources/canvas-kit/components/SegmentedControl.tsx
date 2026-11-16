import type { LucideIcon } from 'lucide-react'
import { cn } from '../lib/cn'
import { focusRing } from '../lib/tokens'
import { useControllable } from '../lib/useControllable'

export interface SegmentItem {
  value: string
  label?: string
  icon?: LucideIcon
}

export interface SegmentedControlProps {
  items: Array<SegmentItem | string>
  value?: string
  defaultValue?: string
  onChange?: (value: string) => void
  /** sm 28px для панелей, md 36px для форм и телефона. */
  size?: 'sm' | 'md'
  fullWidth?: boolean
  label?: string
  className?: string
}

/** Сегменты на общей подложке: переключение вида, периода, фильтра. */
export function SegmentedControl({
  items,
  value,
  defaultValue,
  onChange,
  size = 'md',
  fullWidth,
  label,
  className
}: SegmentedControlProps) {
  const list = items.map((item) => (typeof item === 'string' ? { value: item, label: item } : item))
  const [current, setCurrent] = useControllable(value, defaultValue ?? list[0]?.value ?? '', onChange)
  return (
    <div
      role="radiogroup"
      aria-label={label}
      className={cn(
        'inline-flex items-center gap-0.5 rounded-lg bg-muted p-0.5',
        size === 'sm' ? 'h-7' : 'h-9',
        fullWidth && 'flex w-full',
        className
      )}
    >
      {list.map(({ value: itemValue, label: itemLabel, icon: Glyph }) => {
        const active = itemValue === current
        return (
          <button
            key={itemValue}
            type="button"
            role="radio"
            aria-checked={active}
            aria-label={itemLabel ? undefined : itemValue}
            onClick={() => setCurrent(itemValue)}
            className={cn(
              'inline-flex h-full cursor-pointer items-center justify-center gap-1.5 rounded-md font-semibold whitespace-nowrap transition-colors',
              size === 'sm' ? 'px-2.5 text-xs' : 'px-3 text-sm',
              fullWidth && 'flex-1',
              active
                ? 'bg-surface text-fg shadow-sm dark:bg-muted-strong'
                : 'text-fg-muted hover:text-fg',
              focusRing
            )}
          >
            {Glyph && <Glyph aria-hidden size={size === 'sm' ? 14 : 16} strokeWidth={1.75} />}
            {itemLabel}
          </button>
        )
      })}
    </div>
  )
}
