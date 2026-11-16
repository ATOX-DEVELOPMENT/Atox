import { ChevronLeft, ChevronRight } from 'lucide-react'
import { cn } from '../lib/cn'
import { focusRing } from '../lib/tokens'
import { useControllable } from '../lib/useControllable'

export interface PaginationProps {
  pageCount: number
  page?: number
  defaultPage?: number
  onChange?: (page: number) => void
  /** Текст слева: "Showing 21–40 of 312". */
  summary?: string
  className?: string
}

/** Номера страниц с многоточием: 1 … 4 5 6 … 20. */
function pagesAround(page: number, count: number): Array<number | 'gap'> {
  if (count <= 7) return Array.from({ length: count }, (_, index) => index + 1)
  const middle = [page - 1, page, page + 1].filter((p) => p > 1 && p < count)
  const pages: Array<number | 'gap'> = [1]
  if (middle[0] > 2) pages.push('gap')
  pages.push(...middle)
  if (middle[middle.length - 1] < count - 1) pages.push('gap')
  pages.push(count)
  return pages
}

/** Постраничная навигация под таблицей или списком. */
export function Pagination({ pageCount, page, defaultPage = 1, onChange, summary, className }: PaginationProps) {
  const [current, setCurrent] = useControllable(page, defaultPage, onChange)
  const cell = cn(
    'inline-grid h-8 min-w-8 cursor-pointer place-items-center rounded-md px-2 text-sm tabular-nums transition-colors disabled:pointer-events-none disabled:opacity-40',
    focusRing
  )
  return (
    <nav aria-label="Pagination" className={cn('flex items-center justify-between gap-4', className)}>
      {summary ? <span className="text-sm text-fg-muted tabular-nums">{summary}</span> : <span />}
      <div className="flex items-center gap-1">
        <button
          type="button"
          aria-label="Previous page"
          disabled={current <= 1}
          onClick={() => setCurrent(current - 1)}
          className={cn(cell, 'text-fg-muted hover:bg-muted hover:text-fg')}
        >
          <ChevronLeft aria-hidden size={16} strokeWidth={1.75} />
        </button>
        {pagesAround(current, pageCount).map((item, index) =>
          item === 'gap' ? (
            <span key={`gap-${index}`} className="px-1 text-sm text-fg-subtle">
              …
            </span>
          ) : (
            <button
              key={item}
              type="button"
              aria-current={item === current ? 'page' : undefined}
              onClick={() => setCurrent(item)}
              className={cn(
                cell,
                item === current
                  ? 'border border-border bg-surface font-semibold text-fg shadow-xs'
                  : 'text-fg-muted hover:bg-muted hover:text-fg'
              )}
            >
              {item}
            </button>
          )
        )}
        <button
          type="button"
          aria-label="Next page"
          disabled={current >= pageCount}
          onClick={() => setCurrent(current + 1)}
          className={cn(cell, 'text-fg-muted hover:bg-muted hover:text-fg')}
        >
          <ChevronRight aria-hidden size={16} strokeWidth={1.75} />
        </button>
      </div>
    </nav>
  )
}
