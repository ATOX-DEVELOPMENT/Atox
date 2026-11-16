import type { LucideIcon } from 'lucide-react'
import { cn } from '../lib/cn'
import { useControllable } from '../lib/useControllable'
import { HomeIndicator } from './HomeIndicator'

export interface TabBarItem {
  value: string
  label: string
  icon: LucideIcon
  /** Красный счётчик на иконке. */
  badge?: number
}

export interface TabBarProps {
  items: TabBarItem[]
  value?: string
  defaultValue?: string
  onChange?: (value: string) => void
  /** Нарисовать полоску «домой» под вкладками (по умолчанию да). */
  homeIndicator?: boolean
  className?: string
}

/** Нижняя панель вкладок телефона: от 3 до 5 пунктов, активный в цвете акцента. */
export function TabBar({ items, value, defaultValue, onChange, homeIndicator = true, className }: TabBarProps) {
  const [current, setCurrent] = useControllable(value, defaultValue ?? items[0]?.value ?? '', onChange)
  return (
    <nav
      className={cn(
        'shrink-0 border-t border-border bg-canvas/85 backdrop-blur-xl',
        className
      )}
    >
      <div role="tablist" className="flex h-[50px] items-stretch pt-1.5">
        {items.map(({ value: itemValue, label, icon: Glyph, badge }) => {
          const active = itemValue === current
          return (
            <button
              key={itemValue}
              type="button"
              role="tab"
              aria-selected={active}
              onClick={() => setCurrent(itemValue)}
              className={cn(
                'flex flex-1 cursor-pointer flex-col items-center gap-1 outline-none',
                active ? 'text-accent-text' : 'text-fg-subtle'
              )}
            >
              <span className="relative">
                <Glyph aria-hidden size={24} strokeWidth={active ? 2 : 1.75} />
                {badge !== undefined && badge > 0 && (
                  <span className="absolute -top-1 -right-2.5 grid h-[18px] min-w-[18px] place-items-center rounded-full bg-[#ff3b30] px-1 text-2xs font-semibold text-white tabular-nums">
                    {badge}
                  </span>
                )}
              </span>
              <span className="text-[10px] leading-none font-semibold">{label}</span>
            </button>
          )
        })}
      </div>
      {homeIndicator ? <HomeIndicator /> : null}
    </nav>
  )
}
