import type { HTMLAttributes, ReactNode } from 'react'
import { cn } from '../lib/cn'

export interface CardProps extends HTMLAttributes<HTMLDivElement> {
  /** default: рамка; elevated: рамка и мягкая тень; muted: заливка без рамки; ghost: без всего. */
  variant?: 'default' | 'elevated' | 'muted' | 'ghost'
  /** Внутренний отступ: none для таблиц и списков во всю ширину. */
  padding?: 'none' | 'sm' | 'md' | 'lg'
  /** Наведение как у кликабельной карточки. */
  interactive?: boolean
}

const variantClass = {
  default: 'bg-surface border border-border shadow-xs',
  elevated: 'bg-surface border border-border shadow-md',
  muted: 'bg-muted',
  ghost: ''
} as const

const paddingClass = { none: '', sm: 'p-4', md: 'p-5', lg: 'p-6 md:p-8' } as const

/** Карточка: основной контейнер для группы содержимого. */
export function Card({
  variant = 'default',
  padding = 'md',
  interactive,
  className,
  ...props
}: CardProps) {
  return (
    <div
      className={cn(
        'rounded-xl',
        variantClass[variant],
        paddingClass[padding],
        interactive && 'cursor-pointer transition-[border-color,box-shadow] hover:border-border-strong hover:shadow-md',
        className
      )}
      {...props}
    />
  )
}

export interface CardHeaderProps extends Omit<HTMLAttributes<HTMLDivElement>, 'title'> {
  title: ReactNode
  description?: ReactNode
  /** Кнопка, меню или переключатель справа. */
  action?: ReactNode
}

/** Шапка карточки: заголовок, пояснение и действие справа. */
export function CardHeader({ title, description, action, className, ...props }: CardHeaderProps) {
  return (
    <div className={cn('flex items-start justify-between gap-4', className)} {...props}>
      <div className="grid min-w-0 gap-1">
        <h3 className="text-base font-semibold text-fg">{title}</h3>
        {description && <p className="text-sm text-fg-muted">{description}</p>}
      </div>
      {action && <div className="flex shrink-0 items-center gap-2">{action}</div>}
    </div>
  )
}

/** Подвал карточки с разделителем: кнопки формы, ссылка «View all». */
export function CardFooter({ className, ...props }: HTMLAttributes<HTMLDivElement>) {
  return (
    <div
      className={cn('mt-5 flex items-center justify-end gap-2 border-t border-border pt-4', className)}
      {...props}
    />
  )
}
