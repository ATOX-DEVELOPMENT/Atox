import type { ReactNode } from 'react'
import { cn } from '../lib/cn'
import { Checkbox } from './Checkbox'

export interface TableColumn<Row> {
  /** Ключ поля строки; он же React key колонки. */
  key: string
  header: ReactNode
  /** Своя отрисовка ячейки: Badge статуса, Avatar с именем, сумма. */
  render?: (row: Row) => ReactNode
  align?: 'left' | 'right' | 'center'
  /** Ширина классом: "w-32", "w-[40%]". */
  width?: string
}

export interface TableProps<Row> {
  columns: TableColumn<Row>[]
  rows: Row[]
  /** Уникальный ключ строки. */
  rowKey: (row: Row) => string
  /** Ключи выделенных строк. */
  selected?: string[]
  /** Колонка флажков слева. */
  selectable?: boolean
  /** Плотность строк: compact 36px, regular 48px. */
  density?: 'compact' | 'regular'
  /** Вместо строк, когда rows пуст: обычно EmptyState. */
  empty?: ReactNode
  onRowClick?: (row: Row) => void
  className?: string
}

const alignClass = { left: 'text-left', right: 'text-right', center: 'text-center' } as const

/** Таблица данных: шапка, выделение строк, своя отрисовка ячеек и пустое состояние. */
export function Table<Row>({
  columns,
  rows,
  rowKey,
  selected = [],
  selectable,
  density = 'regular',
  empty,
  onRowClick,
  className
}: TableProps<Row>) {
  const rowHeight = density === 'compact' ? 'h-9' : 'h-12'
  const allSelected = rows.length > 0 && selected.length === rows.length
  return (
    <div className={cn('w-full overflow-x-auto', className)}>
      <table className="w-full border-collapse text-sm tabular-nums">
        <thead>
          <tr className="border-b border-border">
            {selectable && (
              <th className="w-10 pl-5">
                <Checkbox
                  aria-label="Select all"
                  checked={allSelected}
                  indeterminate={selected.length > 0 && !allSelected}
                />
              </th>
            )}
            {columns.map((column) => (
              <th
                key={column.key}
                scope="col"
                className={cn(
                  'h-10 px-4 text-xs first:pl-5 last:pr-5 font-semibold whitespace-nowrap text-fg-muted',
                  alignClass[column.align ?? 'left'],
                  column.width
                )}
              >
                {column.header}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {rows.length === 0 && empty ? (
            <tr>
              <td colSpan={columns.length + (selectable ? 1 : 0)}>{empty}</td>
            </tr>
          ) : (
            rows.map((row) => {
              const key = rowKey(row)
              const isSelected = selected.includes(key)
              return (
                <tr
                  key={key}
                  aria-selected={isSelected || undefined}
                  onClick={onRowClick ? () => onRowClick(row) : undefined}
                  className={cn(
                    'border-b border-border transition-colors last:border-b-0',
                    rowHeight,
                    isSelected ? 'bg-accent-soft' : 'hover:bg-muted/60',
                    onRowClick && 'cursor-pointer'
                  )}
                >
                  {selectable && (
                    <td className="w-10 pl-5">
                      <Checkbox aria-label="Select row" checked={isSelected} />
                    </td>
                  )}
                  {columns.map((column) => (
                    <td
                      key={column.key}
                      className={cn('px-4 whitespace-nowrap text-fg first:pl-5 last:pr-5', alignClass[column.align ?? 'left'], column.width)}
                    >
                      {column.render
                        ? column.render(row)
                        : String((row as Record<string, unknown>)[column.key] ?? '')}
                    </td>
                  ))}
                </tr>
              )
            })
          )}
        </tbody>
      </table>
    </div>
  )
}
