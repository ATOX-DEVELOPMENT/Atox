import type { HTMLAttributes } from 'react'
import type { LucideIcon } from 'lucide-react'
import { X } from 'lucide-react'
import { cn } from '../lib/cn'
import { fillTone, focusRing, type Tone } from '../lib/tokens'

export interface TagProps extends HTMLAttributes<HTMLSpanElement> {
  icon?: LucideIcon
  /** Цветная точка слева: метка проекта, категории. */
  color?: Tone
  selected?: boolean
  /** Показать крестик удаления. */
  onRemove?: () => void
}

/** Метка-фильтр или выбранное значение с крестиком. */
export function Tag({ icon: Glyph, color, selected, onRemove, className, children, ...props }: TagProps) {
  return (
    <span
      className={cn(
        'inline-flex h-7 items-center gap-1.5 rounded-md border px-2 text-sm whitespace-nowrap',
        selected
          ? 'border-accent bg-accent-soft text-accent-text'
          : 'border-border bg-surface text-fg shadow-xs',
        className
      )}
      {...props}
    >
      {color && <span aria-hidden className={cn('size-2 rounded-full', fillTone[color])} />}
      {Glyph && <Glyph aria-hidden size={14} strokeWidth={1.75} className="text-fg-muted" />}
      {children}
      {onRemove && (
        <button
          type="button"
          aria-label="Remove"
          onClick={onRemove}
          className={cn('-mr-1 grid size-5 cursor-pointer place-items-center rounded text-fg-subtle hover:bg-muted hover:text-fg', focusRing)}
        >
          <X aria-hidden size={12} strokeWidth={2} />
        </button>
      )}
    </span>
  )
}
