import type { ButtonHTMLAttributes } from 'react'
import type { LucideIcon } from 'lucide-react'
import { cn } from '../lib/cn'
import { focusRing } from '../lib/tokens'
import { Spinner } from './Spinner'

export type ButtonVariant = 'primary' | 'secondary' | 'outline' | 'ghost' | 'destructive' | 'link'
export type ButtonSize = 'sm' | 'md' | 'lg' | 'xl'

export interface ButtonProps extends ButtonHTMLAttributes<HTMLButtonElement> {
  /** primary: одно главное действие на экране; secondary: остальные; ghost: в панелях. */
  variant?: ButtonVariant
  /** sm 28px, md 36px, lg 44px (минимум на телефоне), xl 52px (главная кнопка телефона). */
  size?: ButtonSize
  icon?: LucideIcon
  iconRight?: LucideIcon
  loading?: boolean
  fullWidth?: boolean
}

export const buttonVariant: Record<ButtonVariant, string> = {
  primary:
    'bg-accent text-accent-fg shadow-xs inset-shadow-[0_1px_0_rgb(255_255_255/0.16)] hover:bg-accent-hover',
  secondary:
    'bg-surface text-fg border border-border shadow-xs hover:bg-muted hover:border-border-strong',
  outline: 'bg-transparent text-fg border border-border-strong hover:bg-muted',
  ghost: 'bg-transparent text-fg-muted hover:bg-muted hover:text-fg',
  destructive: 'bg-danger text-white shadow-xs hover:brightness-110',
  link: 'bg-transparent text-accent-text underline-offset-4 hover:underline px-0 h-auto'
}

const sizeClass: Record<ButtonSize, string> = {
  sm: 'h-7 px-2.5 gap-1.5 text-xs rounded-md',
  md: 'h-9 px-3.5 gap-2 text-sm rounded-md',
  lg: 'h-11 px-5 gap-2 text-base rounded-lg',
  xl: 'h-13 px-6 gap-2.5 text-base rounded-xl'
}

const iconSize: Record<ButtonSize, number> = { sm: 14, md: 16, lg: 18, xl: 20 }

/** Кнопка с вариантами, размерами, иконками и состоянием загрузки. */
export function Button({
  variant = 'primary',
  size = 'md',
  icon: LeadIcon,
  iconRight: TrailIcon,
  loading = false,
  fullWidth = false,
  disabled,
  type = 'button',
  className,
  children,
  ...props
}: ButtonProps) {
  const glyph = iconSize[size]
  return (
    <button
      type={type}
      disabled={disabled || loading}
      aria-busy={loading || undefined}
      className={cn(
        'relative inline-flex shrink-0 cursor-pointer select-none items-center justify-center whitespace-nowrap font-semibold transition-[background-color,border-color,color,box-shadow] duration-150',
        'disabled:pointer-events-none disabled:opacity-50',
        focusRing,
        sizeClass[size],
        buttonVariant[variant],
        fullWidth && 'w-full',
        className
      )}
      {...props}
    >
      {loading ? (
        <Spinner size={size === 'sm' ? 'xs' : 'sm'} />
      ) : (
        LeadIcon && <LeadIcon aria-hidden size={glyph} strokeWidth={1.75} className="-ml-0.5 shrink-0" />
      )}
      {children}
      {TrailIcon && !loading && (
        <TrailIcon aria-hidden size={glyph} strokeWidth={1.75} className="-mr-0.5 shrink-0" />
      )}
    </button>
  )
}
