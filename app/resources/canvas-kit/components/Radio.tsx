import { useId, type InputHTMLAttributes, type ReactNode } from 'react'
import { cn } from '../lib/cn'
import { useControllable } from '../lib/useControllable'

export interface RadioProps extends Omit<InputHTMLAttributes<HTMLInputElement>, 'type' | 'size'> {
  label?: ReactNode
  description?: ReactNode
}

/** Переключатель одного из вариантов с подписью. */
export function Radio({ label, description, id, disabled, className, ...props }: RadioProps) {
  const autoId = useId()
  const inputId = id ?? autoId
  return (
    <div className={cn('flex items-start gap-2.5', disabled && 'opacity-50', className)}>
      <input
        id={inputId}
        type="radio"
        disabled={disabled}
        className={cn(
          'mt-0.5 size-4 shrink-0 cursor-pointer appearance-none rounded-full border border-border-strong bg-surface shadow-xs transition-all',
          'checked:border-[5px] checked:border-accent checked:bg-white',
          'outline-none focus-visible:ring-[3px] focus-visible:ring-ring disabled:cursor-not-allowed'
        )}
        {...props}
      />
      {(label || description) && (
        <label htmlFor={inputId} className="grid cursor-pointer gap-0.5 select-none">
          {label && <span className="text-sm font-semibold text-fg">{label}</span>}
          {description && <span className="text-sm text-fg-muted">{description}</span>}
        </label>
      )}
    </div>
  )
}

export interface RadioOption {
  value: string
  label: ReactNode
  description?: ReactNode
  disabled?: boolean
}

export interface RadioGroupProps {
  options: RadioOption[]
  value?: string
  defaultValue?: string
  onChange?: (value: string) => void
  /** card: каждый вариант в рамке, как выбор тарифа. */
  variant?: 'plain' | 'card'
  label?: string
  className?: string
}

/** Группа переключателей; вариант card для выбора тарифа или способа доставки. */
export function RadioGroup({
  options,
  value,
  defaultValue,
  onChange,
  variant = 'plain',
  label,
  className
}: RadioGroupProps) {
  const name = useId()
  const [current, setCurrent] = useControllable(value, defaultValue ?? '', onChange)
  return (
    <div role="radiogroup" aria-label={label} className={cn('grid', variant === 'card' ? 'gap-2' : 'gap-3', className)}>
      {options.map((option) => {
        const checked = current === option.value
        return (
          <Radio
            key={option.value}
            name={name}
            value={option.value}
            checked={checked}
            disabled={option.disabled}
            onChange={() => setCurrent(option.value)}
            label={option.label}
            description={option.description}
            className={cn(
              variant === 'card' &&
                'rounded-lg border bg-surface p-3.5 transition-colors',
              variant === 'card' && (checked ? 'border-accent ring-1 ring-accent' : 'border-border')
            )}
          />
        )
      })}
    </div>
  )
}
