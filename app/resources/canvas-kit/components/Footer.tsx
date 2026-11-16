import type { ReactNode } from 'react'
import { cn } from '../lib/cn'
import { Container } from './Layout'

export interface FooterColumn {
  title: string
  links: string[]
}

export interface FooterProps {
  brand: ReactNode
  description?: string
  columns: FooterColumn[]
  /** Нижняя строка: копирайт, ссылки на правила. */
  bottom?: ReactNode
  className?: string
}

/** Подвал сайта: логотип с описанием, колонки ссылок и нижняя строка. */
export function Footer({ brand, description, columns, bottom, className }: FooterProps) {
  return (
    <footer className={cn('border-t border-border bg-canvas-subtle', className)}>
      <Container className="grid gap-12 py-14 md:grid-cols-[1.5fr_repeat(4,1fr)]">
        <div className="grid content-start gap-3">
          {brand}
          {description && <p className="max-w-xs text-sm text-fg-muted">{description}</p>}
        </div>
        {columns.map((column) => (
          <div key={column.title} className="grid content-start gap-3">
            <h3 className="text-sm font-semibold text-fg">{column.title}</h3>
            <ul className="grid gap-2.5 text-sm">
              {column.links.map((link) => (
                <li key={link}>
                  <a href="#" className="text-fg-muted transition-colors hover:text-fg">
                    {link}
                  </a>
                </li>
              ))}
            </ul>
          </div>
        ))}
      </Container>
      {bottom && (
        <div className="border-t border-border">
          <Container className="flex h-14 items-center justify-between text-sm text-fg-subtle">{bottom}</Container>
        </div>
      )}
    </footer>
  )
}
