import type { ReactNode } from 'react'
import { cn } from '../lib/cn'

export interface PageHeaderProps {
  title: ReactNode
  description?: ReactNode
  /** Над заголовком: Breadcrumbs или маленькая метка раздела. */
  eyebrow?: ReactNode
  /** Кнопки справа; главная последней. */
  actions?: ReactNode
  /** Под заголовком: Tabs во всю ширину. */
  tabs?: ReactNode
  className?: string
}

/** Заголовок страницы приложения: путь, название, описание, действия и вкладки. */
export function PageHeader({ title, description, eyebrow, actions, tabs, className }: PageHeaderProps) {
  return (
    <div className={cn('grid gap-5', className)}>
      <div className="flex flex-wrap items-end justify-between gap-4">
        <div className="grid min-w-0 gap-1.5">
          {eyebrow && <div className="mb-1">{eyebrow}</div>}
          <h1 className="text-2xl font-semibold text-fg">{title}</h1>
          {description && <p className="max-w-2xl text-sm text-fg-muted">{description}</p>}
        </div>
        {actions && <div className="flex shrink-0 items-center gap-2">{actions}</div>}
      </div>
      {tabs}
    </div>
  )
}
