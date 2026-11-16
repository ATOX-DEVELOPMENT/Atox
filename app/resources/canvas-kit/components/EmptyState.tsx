import type { ReactNode } from 'react'
import type { LucideIcon } from 'lucide-react'
import { cn } from '../lib/cn'

export interface EmptyStateProps {
  icon?: LucideIcon
  title: string
  description?: ReactNode
  /** Одна главная кнопка и, если нужно, вторичная. */
  actions?: ReactNode
  /** Обвести пунктиром: пустая область внутри страницы. */
  bordered?: boolean
  className?: string
}

/** Пустое состояние: иконка в плашке, заголовок, пояснение и действие. */
export function EmptyState({ icon: Glyph, title, description, actions, bordered, className }: EmptyStateProps) {
  return (
    <div
      className={cn(
        'flex flex-col items-center justify-center px-6 py-12 text-center',
        bordered && 'rounded-xl border border-dashed border-border-strong',
        className
      )}
    >
      {Glyph && (
        <div className="mb-4 grid size-12 place-items-center rounded-xl border border-border bg-surface text-fg-muted shadow-sm">
          <Glyph aria-hidden size={22} strokeWidth={1.75} />
        </div>
      )}
      <h3 className="text-base font-semibold text-fg">{title}</h3>
      {description && <p className="mt-1.5 max-w-sm text-sm text-pretty text-fg-muted">{description}</p>}
      {actions && <div className="mt-5 flex items-center gap-2">{actions}</div>}
    </div>
  )
}
