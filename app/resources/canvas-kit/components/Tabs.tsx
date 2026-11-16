import type { LucideIcon } from 'lucide-react'
import { cn } from '../lib/cn'
import { focusRing } from '../lib/tokens'
import { useControllable } from '../lib/useControllable'

export interface TabItem {
  value: string
  label: string
  icon?: LucideIcon
  /** Счётчик рядом с подписью. */
  count?: number
}

export interface TabsProps {
  items: Array<TabItem | string>
  value?: string
  defaultValue?: string
  onChange?: (value: string) => void
  /** underline: под заголовком страницы; pills: внутри карточек и панелей. */
  variant?: 'underline' | 'pills'
  className?: string
}

/** Полоса вкладок; содержимое вкладки рисует сам экран. */
export function Tabs({
  items,
  value,
  defaultValue,
  onChange,
  variant = 'underline',
  className
}: TabsProps) {
  const list = items.map((item) => (typeof item === 'string' ? { value: item, label: item } : item))
  const [current, setCurrent] = useControllable(value, defaultValue ?? list[0]?.value ?? '', onChange)
  const underline = variant === 'underline'
  return (
    <div
      role="tablist"
      className={cn('flex items-center', underline ? 'gap-5 border-b border-border' : 'gap-1', className)}
    >
      {list.map(({ value: itemValue, label, icon: Glyph, count }) => {
        const active = itemValue === current
        return (
          <button
            key={itemValue}
            type="button"
            role="tab"
            aria-selected={active}
            onClick={() => setCurrent(itemValue)}
            className={cn(
              'relative inline-flex cursor-pointer items-center gap-1.5 text-sm font-semibold whitespace-nowrap transition-colors',
              underline
                ? cn(
                    '-mb-px h-10 border-b-2',
                    active ? 'border-fg text-fg' : 'border-transparent text-fg-muted hover:text-fg'
                  )
                : cn(
                    'h-8 rounded-md px-3',
                    active ? 'bg-muted text-fg' : 'text-fg-muted hover:bg-muted hover:text-fg'
                  ),
              focusRing
            )}
          >
            {Glyph && <Glyph aria-hidden size={16} strokeWidth={1.75} />}
            {label}
            {count !== undefined && (
              <span
                className={cn(
                  'rounded-full px-1.5 text-2xs leading-[18px] font-semibold tabular-nums',
                  active ? 'bg-fg text-canvas' : 'bg-muted-strong text-fg-muted'
                )}
              >
                {count}
              </span>
            )}
          </button>
        )
      })}
    </div>
  )
}
