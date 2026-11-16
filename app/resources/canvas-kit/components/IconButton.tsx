import type { ButtonHTMLAttributes } from 'react'
import type { LucideIcon } from 'lucide-react'
import { cn } from '../lib/cn'
import { focusRing } from '../lib/tokens'
import { buttonVariant, type ButtonVariant } from './Button'

export interface IconButtonProps extends ButtonHTMLAttributes<HTMLButtonElement> {
  icon: LucideIcon
  /** Обязательная подпись для чтения с экрана. */
  label: string
  variant?: Exclude<ButtonVariant, 'link'>
  /** sm 28px, md 36px, lg 44px (телефон). */
  size?: 'sm' | 'md' | 'lg'
  round?: boolean
}

const sizeClass = { sm: 'size-7', md: 'size-9', lg: 'size-11' } as const
const glyphSize = { sm: 16, md: 18, lg: 20 } as const

/** Квадратная кнопка с одной иконкой: панели инструментов, шапки, строки таблиц. */
export function IconButton({
  icon: Glyph,
  label,
  variant = 'ghost',
  size = 'md',
  round = false,
  type = 'button',
  className,
  ...props
}: IconButtonProps) {
  return (
    <button
      type={type}
      aria-label={label}
      title={label}
      className={cn(
        'inline-flex shrink-0 cursor-pointer items-center justify-center transition-colors duration-150',
        'disabled:pointer-events-none disabled:opacity-50',
        focusRing,
        sizeClass[size],
        round ? 'rounded-full' : 'rounded-md',
        buttonVariant[variant],
        className
      )}
      {...props}
    >
      <Glyph aria-hidden size={glyphSize[size]} strokeWidth={1.75} />
    </button>
  )
}
