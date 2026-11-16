import type { ReactNode } from 'react'
import { cn } from '../lib/cn'
import { Container } from './Layout'

export interface SiteNavLink {
  label: string
  active?: boolean
}

export interface SiteNavProps {
  /** Обычно Brand. */
  brand: ReactNode
  links?: Array<SiteNavLink | string>
  /** Справа: «Sign in» ghost и главная кнопка. */
  actions?: ReactNode
  /** Полупрозрачный фон и линия снизу. */
  bordered?: boolean
  className?: string
}

/** Шапка сайта: логотип, ссылки по центру, кнопки справа. */
export function SiteNav({ brand, links = [], actions, bordered = true, className }: SiteNavProps) {
  return (
    <header className={cn('shrink-0 bg-canvas/80 backdrop-blur-xl', bordered && 'border-b border-border', className)}>
      <Container className="flex h-16 items-center justify-between gap-6">
        <div className="flex items-center gap-8">
          {brand}
          <nav className="flex items-center gap-1">
            {links.map((link) => {
              const item = typeof link === 'string' ? { label: link } : link
              return (
                <a
                  key={item.label}
                  href="#"
                  aria-current={item.active ? 'page' : undefined}
                  className={cn(
                    'rounded-md px-3 py-1.5 text-sm transition-colors',
                    item.active ? 'font-semibold text-fg' : 'text-fg-muted hover:text-fg'
                  )}
                >
                  {item.label}
                </a>
              )
            })}
          </nav>
        </div>
        {actions && <div className="flex items-center gap-2">{actions}</div>}
      </Container>
    </header>
  )
}
