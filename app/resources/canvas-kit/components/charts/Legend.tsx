import { cn } from '../../lib/cn'

export interface LegendItem {
  label: string
  color: string
  value?: string
}

/** Легенда графика: цветной маркер, подпись и необязательное значение. */
export function Legend({ items, className }: { items: LegendItem[]; className?: string }) {
  return (
    <ul className={cn('flex flex-wrap items-center gap-x-4 gap-y-1.5 text-xs text-fg-muted', className)}>
      {items.map((item) => (
        <li key={item.label} className="flex items-center gap-1.5">
          <span aria-hidden className="size-2 rounded-[3px]" style={{ background: item.color }} />
          {item.label}
          {item.value && <span className="font-semibold text-fg tabular-nums">{item.value}</span>}
        </li>
      ))}
    </ul>
  )
}
