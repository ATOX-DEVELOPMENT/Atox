import { Search } from 'lucide-react'
import { cn } from '../lib/cn'
import { Kbd } from './Kbd'

export interface SearchFieldProps {
  placeholder?: string
  /** Сочетание для открытия поиска. */
  shortcut?: string[]
  value?: string
  onChange?: (value: string) => void
  className?: string
}

/** Поле поиска в панели: иконка, подсказка и сочетание ⌘K. */
export function SearchField({ placeholder = 'Search', shortcut = ['⌘', 'K'], value, onChange, className }: SearchFieldProps) {
  return (
    <label
      className={cn(
        'flex h-8 w-72 cursor-text items-center gap-2 rounded-md border border-border bg-canvas-subtle px-2.5 text-sm text-fg-subtle transition-colors hover:border-border-strong focus-within:border-accent focus-within:ring-[3px] focus-within:ring-ring',
        className
      )}
    >
      <Search aria-hidden size={14} strokeWidth={2} className="shrink-0" />
      <input
        type="search"
        aria-label={placeholder}
        placeholder={placeholder}
        value={value}
        readOnly={value !== undefined && !onChange}
        onChange={onChange ? (event) => onChange(event.target.value) : undefined}
        className="min-w-0 flex-1 bg-transparent text-fg outline-none placeholder:text-fg-subtle [&::-webkit-search-cancel-button]:hidden"
      />
      {shortcut.length > 0 && <Kbd keys={shortcut} />}
    </label>
  )
}
