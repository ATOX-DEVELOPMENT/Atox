import { cn } from '../lib/cn'

export interface SpinnerProps {
  size?: 'xs' | 'sm' | 'md' | 'lg'
  className?: string
  /** Текст для чтения с экрана. */
  label?: string
}

const sizeClass = { xs: 'size-3', sm: 'size-4', md: 'size-5', lg: 'size-8' } as const

/** Кольцевой индикатор загрузки; цвет берётся из currentColor. */
export function Spinner({ size = 'sm', className, label = 'Loading' }: SpinnerProps) {
  return (
    <svg
      role="status"
      aria-label={label}
      viewBox="0 0 24 24"
      fill="none"
      className={cn('shrink-0 animate-spin', sizeClass[size], className)}
    >
      <circle cx="12" cy="12" r="9.5" stroke="currentColor" strokeOpacity="0.2" strokeWidth="2.5" />
      <path
        d="M21.5 12A9.5 9.5 0 0 0 12 2.5"
        stroke="currentColor"
        strokeWidth="2.5"
        strokeLinecap="round"
      />
    </svg>
  )
}
