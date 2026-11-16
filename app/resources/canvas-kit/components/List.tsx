import type { HTMLAttributes, ReactNode } from 'react'
import type { LucideIcon } from 'lucide-react'
import { ChevronRight } from 'lucide-react'
import { cn } from '../lib/cn'

export interface ListProps extends HTMLAttributes<HTMLDivElement> {
  /** Подпись группы над карточкой: «Account», «Notifications». */
  header?: ReactNode
  /** Пояснение под группой. */
  footer?: ReactNode
  /** inset: карточка со скруглением (настройки iOS); plain: строки во всю ширину. */
  variant?: 'inset' | 'plain'
}

/** Группа строк: настройки, контакты, история операций. */
export function List({ header, footer, variant = 'inset', className, children, ...props }: ListProps) {
  return (
    <div className={cn('grid gap-2', className)} {...props}>
      {header && <div className="px-4 text-xs font-semibold tracking-wide text-fg-muted uppercase">{header}</div>}
      <div
        role="list"
        className={cn(
          '[&>*+*]:border-t [&>*+*]:border-border',
          variant === 'inset' && 'overflow-hidden rounded-xl border border-border bg-surface'
        )}
      >
        {children}
      </div>
      {footer && <div className="px-4 text-xs text-fg-muted">{footer}</div>}
    </div>
  )
}

/** Цвет плашки иконки строки, как в настройках iOS. */
const iconBg = {
  accent: 'bg-accent text-accent-fg',
  gray: 'bg-gray-500 text-white',
  blue: 'bg-[#0a84ff] text-white',
  green: 'bg-[#30b158] text-white',
  orange: 'bg-[#ff9500] text-white',
  red: 'bg-[#ff3b30] text-white',
  purple: 'bg-[#8e5cf7] text-white',
  pink: 'bg-[#ff2d55] text-white',
  plain: 'text-fg-muted'
} as const

export interface ListItemProps {
  title: ReactNode
  description?: ReactNode
  icon?: LucideIcon
  /** Плашка иконки: цвет по смыслу пункта или plain без плашки. */
  iconColor?: keyof typeof iconBg
  /** Узел слева вместо иконки: Avatar, логотип. */
  leading?: ReactNode
  /** Значение справа серым: «English», «On», «$12.00». */
  value?: ReactNode
  /** Элемент справа: Switch, Badge, Button. */
  trailing?: ReactNode
  chevron?: boolean
  destructive?: boolean
  onClick?: () => void
  className?: string
}

/** Строка списка: иконка, текст, значение, переключатель или стрелка. */
export function ListItem({
  title,
  description,
  icon: Glyph,
  iconColor = 'plain',
  leading,
  value,
  trailing,
  chevron,
  destructive,
  onClick,
  className
}: ListItemProps) {
  const Tag = onClick || chevron ? 'button' : 'div'
  return (
    <Tag
      role="listitem"
      type={Tag === 'button' ? 'button' : undefined}
      onClick={onClick}
      className={cn(
        'flex min-h-12 w-full items-center gap-3 px-4 py-2.5 text-left',
        Tag === 'button' && 'cursor-pointer transition-colors hover:bg-muted/70 focus-visible:bg-muted focus-visible:outline-none',
        className
      )}
    >
      {leading}
      {!leading && Glyph && (
        <span
          className={cn(
            'grid shrink-0 place-items-center',
            iconColor === 'plain' ? 'size-5' : 'size-7 rounded-[7px]',
            iconBg[iconColor]
          )}
        >
          <Glyph aria-hidden size={iconColor === 'plain' ? 20 : 17} strokeWidth={1.75} />
        </span>
      )}
      <span className="grid min-w-0 flex-1 gap-0.5">
        <span className={cn('truncate text-base', destructive ? 'text-danger-text' : 'text-fg')}>{title}</span>
        {description && <span className="truncate text-sm text-fg-muted">{description}</span>}
      </span>
      {value && <span className="shrink-0 text-base text-fg-muted tabular-nums">{value}</span>}
      {trailing}
      {chevron && <ChevronRight aria-hidden size={18} strokeWidth={2} className="-mr-1 shrink-0 text-fg-subtle" />}
    </Tag>
  )
}
