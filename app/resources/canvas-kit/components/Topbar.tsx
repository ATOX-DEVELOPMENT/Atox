import type { ReactNode } from 'react'
import { cn } from '../lib/cn'

export interface TopbarProps {
  /** Слева: Breadcrumbs, заголовок или кнопка свернуть панель. */
  leading?: ReactNode
  /** По центру: SearchField или SegmentedControl. */
  center?: ReactNode
  /** Справа: иконки, аватар, главная кнопка. */
  actions?: ReactNode
  className?: string
}

/** Верхняя панель приложения или панель инструментов (56px). */
export function Topbar({ leading, center, actions, className }: TopbarProps) {
  return (
    <header
      className={cn(
        'grid h-14 shrink-0 grid-cols-[1fr_auto_1fr] items-center gap-4 border-b border-border bg-canvas px-5',
        className
      )}
    >
      <div className="flex min-w-0 items-center gap-3">{leading}</div>
      <div className="flex items-center">{center}</div>
      <div className="flex items-center justify-end gap-2">{actions}</div>
    </header>
  )
}
