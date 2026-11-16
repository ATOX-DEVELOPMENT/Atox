import type { LucideIcon } from 'lucide-react'
import { ChevronRight } from 'lucide-react'
import { cn } from '../lib/cn'
import { focusRing } from '../lib/tokens'

export interface Crumb {
  label: string
  icon?: LucideIcon
  onClick?: () => void
}

export interface BreadcrumbsProps {
  items: Array<Crumb | string>
  className?: string
}

/** Путь до текущей страницы; последний пункт текущий и не кликается. */
export function Breadcrumbs({ items, className }: BreadcrumbsProps) {
  const list = items.map((item) => (typeof item === 'string' ? { label: item } : item))
  return (
    <nav aria-label="Breadcrumb" className={className}>
      <ol className="flex items-center gap-1 text-sm">
        {list.map(({ label, icon: Glyph, onClick }, index) => {
          const last = index === list.length - 1
          return (
            <li key={`${label}-${index}`} className="flex items-center gap-1">
              {last ? (
                <span aria-current="page" className="inline-flex items-center gap-1.5 px-1 font-semibold text-fg">
                  {Glyph && <Glyph aria-hidden size={14} strokeWidth={1.75} />}
                  {label}
                </span>
              ) : (
                <>
                  <button
                    type="button"
                    onClick={onClick}
                    className={cn('inline-flex cursor-pointer items-center gap-1.5 rounded px-1 text-fg-muted hover:text-fg', focusRing)}
                  >
                    {Glyph && <Glyph aria-hidden size={14} strokeWidth={1.75} />}
                    {label}
                  </button>
                  <ChevronRight aria-hidden size={14} strokeWidth={1.75} className="text-fg-subtle" />
                </>
              )}
            </li>
          )
        })}
      </ol>
    </nav>
  )
}
