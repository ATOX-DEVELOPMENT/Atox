import { useId, type ReactNode } from 'react'
import { cn } from '../lib/cn'
import { focusRing } from '../lib/tokens'
import { useControllable } from '../lib/useControllable'

export interface SwitchProps {
  checked?: boolean
  defaultChecked?: boolean
  onChange?: (checked: boolean) => void
  disabled?: boolean
  /** sm для десктопа (16px), md для телефона (31px как в iOS). */
  size?: 'sm' | 'md'
  label?: ReactNode
  description?: ReactNode
  className?: string
}

const track = { sm: 'h-4 w-7', md: 'h-[31px] w-[51px]' } as const
const thumb = {
  sm: 'size-3 translate-x-0.5 data-[on]:translate-x-[14px]',
  md: 'size-[27px] translate-x-0.5 data-[on]:translate-x-[22px]'
} as const

/** Тумблер вкл/выкл: role="switch", работает и как статичная картинка, и вживую. */
export function Switch({
  checked,
  defaultChecked = false,
  onChange,
  disabled,
  size = 'sm',
  label,
  description,
  className
}: SwitchProps) {
  const id = useId()
  const [on, setOn] = useControllable(checked, defaultChecked, onChange)
  const control = (
    <button
      id={id}
      type="button"
      role="switch"
      aria-checked={on}
      disabled={disabled}
      onClick={() => setOn(!on)}
      data-on={on || undefined}
      className={cn(
        'relative inline-flex shrink-0 cursor-pointer items-center rounded-full transition-colors duration-200',
        'disabled:cursor-not-allowed disabled:opacity-50',
        on ? 'bg-accent' : 'bg-muted-strong',
        focusRing,
        track[size]
      )}
    >
      <span
        data-on={on || undefined}
        className={cn(
          'pointer-events-none block rounded-full bg-white shadow-[0_1px_3px_rgb(0_0_0/0.2),0_0_0_0.5px_rgb(0_0_0/0.04)] transition-transform duration-200',
          thumb[size]
        )}
      />
    </button>
  )
  if (!label && !description) return <span className={className}>{control}</span>
  return (
    <div className={cn('flex items-start justify-between gap-4', className)}>
      <label htmlFor={id} className="grid cursor-pointer gap-0.5 select-none">
        {label && <span className="text-sm font-semibold text-fg">{label}</span>}
        {description && <span className="text-sm text-fg-muted">{description}</span>}
      </label>
      {control}
    </div>
  )
}
