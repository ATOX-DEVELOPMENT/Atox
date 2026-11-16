import type { HTMLAttributes, ReactNode } from 'react'
import type { LucideIcon } from 'lucide-react'
import { Check } from 'lucide-react'
import { cn } from '../lib/cn'
import { Kbd } from './Kbd'

export interface PopoverProps extends HTMLAttributes<HTMLDivElement> {
  /** Ширина панели классом, по умолчанию w-56. */
  width?: string
}

/** Всплывающая панель, показанная открытой: основа меню, фильтров и выбора даты. */
export function Popover({ width = 'w-56', className, ...props }: PopoverProps) {
  return (
    <div
      className={cn('rounded-xl border border-border bg-surface-raised p-1 shadow-lg', width, className)}
      {...props}
    />
  )
}

export type MenuEntry =
  | {
      label: string
      icon?: LucideIcon
      /** Сочетание клавиш справа: ['⌘', 'D']. */
      shortcut?: string[]
      /** Подсвеченный пункт (под курсором). */
      active?: boolean
      /** Галочка выбранного значения. */
      checked?: boolean
      danger?: boolean
      disabled?: boolean
      onSelect?: () => void
    }
  | { separator: true }
  | { heading: string }

export interface MenuProps {
  items: MenuEntry[]
  width?: string
  header?: ReactNode
  className?: string
}

/** Открытое меню действий: иконки, сочетания клавиш, разделители, опасные пункты. */
export function Menu({ items, width, header, className }: MenuProps) {
  return (
    <Popover role="menu" width={width} className={className}>
      {header}
      {items.map((item, index) => {
        if ('separator' in item) return <div key={`sep-${index}`} role="separator" className="-mx-1 my-1 h-px bg-border" />
        if ('heading' in item)
          return (
            <div key={item.heading} className="px-2 pt-2 pb-1 text-2xs font-semibold tracking-wide text-fg-subtle uppercase">
              {item.heading}
            </div>
          )
        const { label, icon: Glyph, shortcut, active, checked, danger, disabled, onSelect } = item
        return (
          <button
            key={label}
            type="button"
            role="menuitem"
            disabled={disabled}
            onClick={onSelect}
            className={cn(
              'flex h-8 w-full cursor-pointer items-center gap-2.5 rounded-md px-2 text-left text-sm outline-none',
              danger ? 'text-danger-text' : 'text-fg',
              active ? (danger ? 'bg-danger-soft' : 'bg-muted') : 'hover:bg-muted focus-visible:bg-muted',
              'disabled:pointer-events-none disabled:opacity-40'
            )}
          >
            {Glyph && (
              <Glyph aria-hidden size={16} strokeWidth={1.75} className={danger ? '' : 'text-fg-muted'} />
            )}
            <span className="flex-1 truncate">{label}</span>
            {checked && <Check aria-hidden size={16} strokeWidth={2} className="text-accent-text" />}
            {shortcut && <Kbd keys={shortcut} className="opacity-80" />}
          </button>
        )
      })}
    </Popover>
  )
}
