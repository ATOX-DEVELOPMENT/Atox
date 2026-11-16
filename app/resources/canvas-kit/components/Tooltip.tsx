import type { ReactNode } from 'react'
import { cn } from '../lib/cn'
import { Kbd } from './Kbd'

export interface TooltipProps {
  /** Текст подсказки. */
  content: ReactNode
  /** Сочетание клавиш справа от текста. */
  shortcut?: string[]
  side?: 'top' | 'bottom' | 'left' | 'right'
  /** Элемент, к которому привязана подсказка; без него рисуется только сама плашка. */
  children?: ReactNode
  className?: string
}

const sideClass = {
  top: 'bottom-full left-1/2 mb-2 -translate-x-1/2',
  bottom: 'top-full left-1/2 mt-2 -translate-x-1/2',
  left: 'right-full top-1/2 mr-2 -translate-y-1/2',
  right: 'left-full top-1/2 ml-2 -translate-y-1/2'
} as const

/** Статичная подсказка, показанная открытой: для макетов состояний наведения. */
export function Tooltip({ content, shortcut, side = 'top', children, className }: TooltipProps) {
  const bubble = (
    <span
      role="tooltip"
      className={cn(
        'inline-flex items-center gap-2 rounded-md bg-inverse px-2 py-1 text-xs font-semibold whitespace-nowrap text-inverse-fg shadow-md',
        children !== undefined && cn('absolute z-20', sideClass[side]),
        className
      )}
    >
      {content}
      {shortcut && <Kbd keys={shortcut} tone="inverse" />}
    </span>
  )
  if (children === undefined) return bubble
  return (
    <span className="relative inline-flex">
      {children}
      {bubble}
    </span>
  )
}
