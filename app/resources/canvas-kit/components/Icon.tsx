import type { LucideIcon } from 'lucide-react'
import { cn } from '../lib/cn'

export interface IconProps {
  icon: LucideIcon
  /** 16 для плотного интерфейса и текста sm, 20 для мобильных и крупных кнопок. */
  size?: 12 | 14 | 16 | 18 | 20 | 24 | 28 | 32
  className?: string
}

/** Иконка lucide с толщиной линии набора (1.75) и без влияния на выравнивание строки. */
export function Icon({ icon: Glyph, size = 16, className }: IconProps) {
  return (
    <Glyph
      aria-hidden
      size={size}
      strokeWidth={1.75}
      className={cn('shrink-0', className)}
    />
  )
}
