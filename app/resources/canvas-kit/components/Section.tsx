import type { ReactNode } from 'react'
import { cn } from '../lib/cn'

export interface SectionProps {
  title?: ReactNode
  description?: ReactNode
  actions?: ReactNode
  /** side: заголовок слева, содержимое справа (страницы настроек). */
  layout?: 'stacked' | 'side'
  children: ReactNode
  className?: string
}

/** Раздел страницы: заголовок с пояснением и содержимое. */
export function Section({ title, description, actions, layout = 'stacked', children, className }: SectionProps) {
  const head = (title || description || actions) && (
    <div className={cn('flex items-start justify-between gap-4', layout === 'side' && 'flex-col')}>
      <div className="grid gap-1">
        {title && <h2 className="text-base font-semibold text-fg">{title}</h2>}
        {description && <p className="text-sm text-fg-muted">{description}</p>}
      </div>
      {actions && <div className="flex shrink-0 items-center gap-2">{actions}</div>}
    </div>
  )
  return (
    <section
      className={cn(
        layout === 'side' ? 'grid gap-6 md:grid-cols-[minmax(0,1fr)_minmax(0,2fr)] md:gap-10' : 'grid gap-4',
        className
      )}
    >
      {head}
      <div className="min-w-0">{children}</div>
    </section>
  )
}
