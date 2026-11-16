import type { LucideIcon } from 'lucide-react'
import { CornerDownLeft, Search } from 'lucide-react'
import { cn } from '../lib/cn'
import { Kbd } from './Kbd'

export interface CommandItem {
  label: string
  icon?: LucideIcon
  /** Серый текст справа от подписи: раздел, путь. */
  hint?: string
  shortcut?: string[]
}

export interface CommandGroup {
  heading: string
  items: CommandItem[]
}

export interface CommandBarProps {
  query?: string
  placeholder?: string
  groups: CommandGroup[]
  /** Индекс подсвеченного пункта по всем группам подряд. */
  activeIndex?: number
  className?: string
}

/** Палитра команд ⌘K, показанная открытой: строка запроса и группы результатов. */
export function CommandBar({
  query,
  placeholder = 'Type a command or search',
  groups,
  activeIndex = 0,
  className
}: CommandBarProps) {
  let index = -1
  return (
    <div
      role="dialog"
      aria-label="Command menu"
      className={cn('w-full max-w-xl overflow-hidden rounded-2xl border border-border bg-surface-raised shadow-xl', className)}
    >
      <div className="flex h-12 items-center gap-3 border-b border-border px-4">
        <Search aria-hidden size={16} strokeWidth={2} className="text-fg-subtle" />
        <input
          aria-label={placeholder}
          placeholder={placeholder}
          value={query}
          readOnly
          className="min-w-0 flex-1 bg-transparent text-base text-fg outline-none placeholder:text-fg-subtle"
        />
        <Kbd keys={['esc']} />
      </div>
      <div role="listbox" className="grid gap-2 p-2">
        {groups.map((group) => (
          <div key={group.heading} className="grid gap-0.5">
            <div className="px-2 pt-1 pb-1 text-xs font-semibold text-fg-subtle">{group.heading}</div>
            {group.items.map(({ label, icon: Glyph, hint, shortcut }) => {
              index += 1
              const active = index === activeIndex
              return (
                <div
                  key={label}
                  role="option"
                  aria-selected={active}
                  className={cn('flex h-10 items-center gap-3 rounded-lg px-2 text-sm', active ? 'bg-muted text-fg' : 'text-fg')}
                >
                  {Glyph && <Glyph aria-hidden size={16} strokeWidth={1.75} className="text-fg-muted" />}
                  <span className="truncate">{label}</span>
                  {hint && <span className="truncate text-fg-subtle">{hint}</span>}
                  <span className="ml-auto flex items-center gap-2">
                    {shortcut && <Kbd keys={shortcut} />}
                    {active && !shortcut && <CornerDownLeft aria-hidden size={14} strokeWidth={1.75} className="text-fg-subtle" />}
                  </span>
                </div>
              )
            })}
          </div>
        ))}
      </div>
    </div>
  )
}
