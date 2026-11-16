import type { LucideIcon } from 'lucide-react'
import { cn } from '../lib/cn'

export interface Feature {
  icon: LucideIcon
  title: string
  description: string
}

export interface FeatureGridProps {
  features: Feature[]
  columns?: 2 | 3 | 4
  /** card: каждая в карточке; plain: на фоне страницы. */
  variant?: 'plain' | 'card'
  className?: string
}

const columnsClass = { 2: 'md:grid-cols-2', 3: 'md:grid-cols-3', 4: 'md:grid-cols-4' } as const

/** Сетка преимуществ: иконка в плашке, заголовок, одна-две строки текста. */
export function FeatureGrid({ features, columns = 3, variant = 'plain', className }: FeatureGridProps) {
  return (
    <div className={cn('grid gap-x-8 gap-y-10', columnsClass[columns], variant === 'card' && 'gap-4 gap-y-4', className)}>
      {features.map(({ icon: Glyph, title, description }) => (
        <div
          key={title}
          className={cn('grid content-start gap-3', variant === 'card' && 'rounded-xl border border-border bg-surface p-6 shadow-xs')}
        >
          <div className="grid size-9 place-items-center rounded-lg border border-border bg-surface text-accent-text shadow-xs">
            <Glyph aria-hidden size={18} strokeWidth={1.75} />
          </div>
          <h3 className="mt-1 text-base font-semibold text-fg">{title}</h3>
          <p className="text-sm text-fg-muted">{description}</p>
        </div>
      ))}
    </div>
  )
}
