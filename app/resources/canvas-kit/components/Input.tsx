import type { InputHTMLAttributes, ReactNode } from 'react'
import type { LucideIcon } from 'lucide-react'
import { cn } from '../lib/cn'

/** Общий вид полей ввода: рамка, фон, фокус и ошибка. */
export const fieldBase =
  'w-full bg-surface text-fg border border-border shadow-xs transition-[border-color,box-shadow] duration-150 placeholder:text-fg-subtle hover:border-border-strong focus-within:border-accent focus-within:ring-[3px] focus-within:ring-ring disabled:opacity-50'

export const fieldInvalid =
  'border-danger hover:border-danger focus-within:border-danger focus-within:ring-danger-soft'

const sizeClass = {
  sm: 'h-8 text-sm rounded-md px-2.5 gap-2',
  md: 'h-9 text-sm rounded-md px-3 gap-2',
  lg: 'h-11 text-base rounded-lg px-3.5 gap-2.5'
} as const

export interface InputProps extends Omit<InputHTMLAttributes<HTMLInputElement>, 'size'> {
  /** sm 32px, md 36px (десктоп), lg 44px (телефон, формы входа). */
  size?: keyof typeof sizeClass
  icon?: LucideIcon
  /** Хвост поля: единица измерения, Kbd, IconButton. */
  suffix?: ReactNode
  invalid?: boolean
}

/** Однострочное поле с иконкой слева и хвостом справа. */
export function Input({
  size = 'md',
  icon: Glyph,
  suffix,
  invalid,
  disabled,
  className,
  ...props
}: InputProps) {
  return (
    <div
      className={cn(
        'flex items-center',
        fieldBase,
        sizeClass[size],
        invalid && fieldInvalid,
        disabled && 'pointer-events-none opacity-50',
        className
      )}
    >
      {Glyph && (
        <Glyph aria-hidden size={size === 'lg' ? 18 : 16} strokeWidth={1.75} className="shrink-0 text-fg-subtle" />
      )}
      <input
        disabled={disabled}
        aria-invalid={invalid || undefined}
        readOnly={props.value !== undefined && !props.onChange}
        className="h-full min-w-0 flex-1 bg-transparent outline-none placeholder:text-fg-subtle"
        {...props}
      />
      {suffix && <span className="flex shrink-0 items-center text-fg-subtle">{suffix}</span>}
    </div>
  )
}
