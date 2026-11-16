import type { HTMLAttributes } from 'react'
import { cn } from '../lib/cn'
import type { Accent } from '../lib/tokens'

export interface ThemeProps extends HTMLAttributes<HTMLDivElement> {
  /** Тема ветки. Без значения наследуется от предка (например, класс `dark` на html). */
  mode?: 'light' | 'dark'
  /** Акцентная палитра ветки. */
  accent?: Accent
}

/** Задаёт тему и акцент для всего, что внутри: светлая/тёмная ветка в любом месте экрана. */
export function Theme({ mode, accent, className, children, ...props }: ThemeProps) {
  return (
    <div
      data-accent={accent}
      className={cn(mode, mode && 'bg-canvas text-fg', className)}
      {...props}
    >
      {children}
    </div>
  )
}
