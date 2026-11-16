import type { ReactNode } from 'react'
import { cn } from '../lib/cn'
import { Overlay } from './Overlay'

export interface SheetProps {
  title?: ReactNode
  description?: ReactNode
  children?: ReactNode
  /** Кнопки внизу листа во всю ширину. */
  footer?: ReactNode
  /** Показать поверх затемнённого экрана, прижатым к низу. */
  overlay?: boolean
  className?: string
}

/** Нижний лист телефона с ручкой: фильтры, детали, подтверждения. */
export function Sheet({ title, description, children, footer, overlay = false, className }: SheetProps) {
  const panel = (
    <div
      role="dialog"
      className={cn(
        'w-full rounded-t-[28px] border-t border-border bg-surface-raised px-5 pt-2 pb-[42px] shadow-xl',
        className
      )}
    >
      <div aria-hidden className="mx-auto mb-4 h-[5px] w-9 rounded-full bg-border-strong" />
      {(title || description) && (
        <div className="mb-4 grid gap-1">
          {title && <h2 className="text-lg font-semibold text-fg">{title}</h2>}
          {description && <p className="text-sm text-fg-muted">{description}</p>}
        </div>
      )}
      {children}
      {footer && <div className="mt-6 grid gap-2">{footer}</div>}
    </div>
  )
  return overlay ? <Overlay align="bottom">{panel}</Overlay> : panel
}
