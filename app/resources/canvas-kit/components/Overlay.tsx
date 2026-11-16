import type { ReactNode } from 'react'
import { cn } from '../lib/cn'

export interface OverlayProps {
  /** Где стоит содержимое поверх затемнения. */
  align?: 'center' | 'bottom' | 'right'
  children: ReactNode
  className?: string
}

const alignClass = {
  center: 'items-center justify-center p-6',
  bottom: 'items-end justify-center',
  right: 'items-stretch justify-end'
} as const

/** Затемнение поверх экрана для показа модалок и листов в открытом виде. */
export function Overlay({ align = 'center', children, className }: OverlayProps) {
  return (
    <div className={cn('absolute inset-0 z-40 flex bg-gray-950/40 backdrop-blur-[2px]', alignClass[align], className)}>
      {children}
    </div>
  )
}
