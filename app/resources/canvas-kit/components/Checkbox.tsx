import { useId, type InputHTMLAttributes, type ReactNode } from 'react'
import { Check, Minus } from 'lucide-react'
import { cn } from '../lib/cn'

export interface CheckboxProps extends Omit<InputHTMLAttributes<HTMLInputElement>, 'type' | 'size'> {
  label?: ReactNode
  description?: ReactNode
  /** Частично выбрано: «выбрать всё» в таблице. */
  indeterminate?: boolean
}

/** Флажок с подписью и пояснением; нативный input, поэтому работает с клавиатуры. */
export function Checkbox({
  label,
  description,
  indeterminate,
  id,
  disabled,
  className,
  ...props
}: CheckboxProps) {
  const autoId = useId()
  const inputId = id ?? autoId
  const Mark = indeterminate ? Minus : Check
  return (
    <div className={cn('flex items-start gap-2.5', disabled && 'opacity-50', className)}>
      <span className="relative mt-0.5 flex size-4 shrink-0">
        <input
          id={inputId}
          type="checkbox"
          disabled={disabled}
          aria-checked={indeterminate ? 'mixed' : undefined}
          data-indeterminate={indeterminate || undefined}
          readOnly={props.checked !== undefined && !props.onChange}
          className={cn(
            'peer size-4 cursor-pointer appearance-none rounded-[5px] border border-border-strong bg-surface shadow-xs transition-colors',
            'checked:border-accent checked:bg-accent data-[indeterminate]:border-accent data-[indeterminate]:bg-accent',
            'outline-none focus-visible:ring-[3px] focus-visible:ring-ring disabled:cursor-not-allowed'
          )}
          {...props}
        />
        <Mark
          aria-hidden
          size={12}
          strokeWidth={3}
          className={cn(
            'pointer-events-none absolute inset-0 m-auto text-accent-fg opacity-0',
            indeterminate ? 'opacity-100' : 'peer-checked:opacity-100'
          )}
        />
      </span>
      {(label || description) && (
        <label htmlFor={inputId} className="grid cursor-pointer gap-0.5 select-none">
          {label && <span className="text-sm font-semibold text-fg">{label}</span>}
          {description && <span className="text-sm text-fg-muted">{description}</span>}
        </label>
      )}
    </div>
  )
}
