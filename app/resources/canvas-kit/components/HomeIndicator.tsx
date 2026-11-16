import { cn } from '../lib/cn'

export interface HomeIndicatorProps {
  tone?: 'auto' | 'light' | 'dark'
  className?: string
}

const toneClass = { auto: 'bg-fg', light: 'bg-white', dark: 'bg-gray-950' } as const

/** Полоска «домой» внизу iPhone в своей области 34px. */
export function HomeIndicator({ tone = 'auto', className }: HomeIndicatorProps) {
  return (
    <div aria-hidden className={cn('flex h-[34px] shrink-0 items-end justify-center pb-2', className)}>
      <span className={cn('h-[5px] w-[134px] rounded-full', toneClass[tone])} />
    </div>
  )
}
