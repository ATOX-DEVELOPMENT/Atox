import { cn } from '../lib/cn'

export interface KbdProps {
  /** Клавиши по отдельности: ['⌘', 'K']. */
  keys: string[]
  tone?: 'default' | 'inverse'
  className?: string
}

/** Сочетание клавиш. */
export function Kbd({ keys, tone = 'default', className }: KbdProps) {
  return (
    <span className={cn('inline-flex items-center gap-0.5', className)}>
      {keys.map((key) => (
        <kbd
          key={key}
          className={cn(
            'inline-grid h-5 min-w-5 place-items-center rounded px-1 font-sans text-2xs font-semibold',
            tone === 'default'
              ? 'border border-border bg-surface text-fg-muted shadow-[0_1px_0_var(--atox-border)]'
              : 'bg-inverse-fg/15 text-inverse-fg'
          )}
        >
          {key}
        </kbd>
      ))}
    </span>
  )
}
