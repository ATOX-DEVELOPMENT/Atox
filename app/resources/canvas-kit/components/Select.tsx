import type { SelectHTMLAttributes } from 'react'
import { ChevronsUpDown } from 'lucide-react'
import { cn } from '../lib/cn'
import { fieldBase, fieldInvalid } from './Input'

export interface SelectOption {
  value: string
  label: string
  disabled?: boolean
}

export interface SelectProps extends Omit<SelectHTMLAttributes<HTMLSelectElement>, 'size'> {
  options: Array<SelectOption | string>
  size?: 'sm' | 'md' | 'lg'
  placeholder?: string
  invalid?: boolean
}

const sizeClass = {
  sm: 'h-8 text-sm rounded-md',
  md: 'h-9 text-sm rounded-md',
  lg: 'h-11 text-base rounded-lg'
} as const

/** Выпадающий список на нативном select в стиле полей набора. */
export function Select({
  options,
  size = 'md',
  placeholder,
  invalid,
  className,
  defaultValue,
  ...props
}: SelectProps) {
  return (
    <div className={cn('relative flex items-center', fieldBase, sizeClass[size], invalid && fieldInvalid, className)}>
      <select
        aria-invalid={invalid || undefined}
        defaultValue={defaultValue ?? (placeholder ? '' : undefined)}
        className="h-full w-full cursor-pointer appearance-none bg-transparent pr-8 pl-3 outline-none"
        {...props}
      >
        {placeholder && (
          <option value="" disabled>
            {placeholder}
          </option>
        )}
        {options.map((option) => {
          const item = typeof option === 'string' ? { value: option, label: option } : option
          return (
            <option key={item.value} value={item.value} disabled={item.disabled}>
              {item.label}
            </option>
          )
        })}
      </select>
      <ChevronsUpDown
        aria-hidden
        size={14}
        strokeWidth={1.75}
        className="pointer-events-none absolute right-2.5 text-fg-subtle"
      />
    </div>
  )
}
