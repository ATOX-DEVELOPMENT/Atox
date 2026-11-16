import type { LucideIcon } from 'lucide-react'
import { cn } from '../lib/cn'

export interface BrandProps {
  name: string
  /** Знак в квадрате акцентного цвета. */
  icon: LucideIcon
  size?: 'sm' | 'md' | 'lg'
  /** Только знак без названия. */
  markOnly?: boolean
  className?: string
}

const markSize = { sm: 'size-6 rounded-md', md: 'size-7 rounded-lg', lg: 'size-9 rounded-[10px]' } as const
const glyphSize = { sm: 14, md: 16, lg: 20 } as const
const textSize = { sm: 'text-sm', md: 'text-base', lg: 'text-lg' } as const

/** Логотип продукта без картинок: знак lucide в акцентной плашке и название. */
export function Brand({ name, icon: Glyph, size = 'md', markOnly, className }: BrandProps) {
  return (
    <span className={cn('inline-flex items-center gap-2.5', className)}>
      <span
        className={cn(
          'grid shrink-0 place-items-center bg-accent text-accent-fg shadow-xs inset-shadow-[0_1px_0_rgb(255_255_255/0.2)]',
          markSize[size]
        )}
      >
        <Glyph aria-hidden size={glyphSize[size]} strokeWidth={2.25} />
      </span>
      {markOnly ? <span className="sr-only">{name}</span> : (
        <span className={cn('font-semibold tracking-tight text-fg', textSize[size])}>{name}</span>
      )}
    </span>
  )
}
