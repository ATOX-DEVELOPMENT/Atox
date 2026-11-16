import type { HTMLAttributes } from 'react'
import type { LucideIcon } from 'lucide-react'
import { cn } from '../lib/cn'
import { fillTone, softTone, solidTone, type Tone } from '../lib/tokens'

export interface BadgeProps extends HTMLAttributes<HTMLSpanElement> {
  tone?: Tone
  /** soft: по умолчанию; solid: счётчики и «New»; outline: нейтральные метки. */
  variant?: 'soft' | 'solid' | 'outline'
  size?: 'sm' | 'md'
  /** Точка статуса перед текстом. */
  dot?: boolean
  icon?: LucideIcon
}

/** Короткая метка статуса или количества. */
export function Badge({
  tone = 'neutral',
  variant = 'soft',
  size = 'sm',
  dot,
  icon: Glyph,
  className,
  children,
  ...props
}: BadgeProps) {
  return (
    <span
      className={cn(
        'inline-flex shrink-0 items-center gap-1 rounded-full font-semibold whitespace-nowrap tabular-nums',
        size === 'sm' ? 'h-5 px-2 text-xs' : 'h-6 px-2.5 text-sm',
        variant === 'soft' && softTone[tone],
        variant === 'solid' && solidTone[tone],
        variant === 'outline' && 'border border-border text-fg-muted',
        className
      )}
      {...props}
    >
      {dot && (
        <span
          aria-hidden
          className={cn('size-1.5 rounded-full', variant === 'solid' ? 'bg-current' : fillTone[tone])}
        />
      )}
      {Glyph && <Glyph aria-hidden size={12} strokeWidth={2} />}
      {children}
    </span>
  )
}
