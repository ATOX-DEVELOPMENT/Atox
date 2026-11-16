import type { ReactNode } from 'react'
import type { LucideIcon } from 'lucide-react'
import { X } from 'lucide-react'
import { cn } from '../lib/cn'
import { softTone, type Tone } from '../lib/tokens'
import { IconButton } from './IconButton'
import { Overlay } from './Overlay'

export interface DialogProps {
  title: ReactNode
  description?: ReactNode
  /** Иконка в цветной плашке над заголовком: подтверждения, предупреждения. */
  icon?: LucideIcon
  iconTone?: Tone
  children?: ReactNode
  /** Кнопки внизу; главная справа. */
  footer?: ReactNode
  onClose?: () => void
  size?: 'sm' | 'md' | 'lg'
  /** Показать поверх затемнённого экрана; без него диалог стоит в потоке. */
  overlay?: boolean
  className?: string
}

const sizeClass = { sm: 'max-w-sm', md: 'max-w-md', lg: 'max-w-xl' } as const

/** Модальное окно, показанное открытым прямо на экране. */
export function Dialog({
  title,
  description,
  icon: Glyph,
  iconTone = 'accent',
  children,
  footer,
  onClose,
  size = 'md',
  overlay = false,
  className
}: DialogProps) {
  const panel = (
    <div
      role="dialog"
      aria-modal={overlay || undefined}
      className={cn(
        'relative w-full rounded-2xl border border-border bg-surface-raised shadow-xl',
        sizeClass[size],
        className
      )}
    >
      <div className="grid gap-4 p-6">
        {Glyph && (
          <div className={cn('grid size-10 place-items-center rounded-full', softTone[iconTone])}>
            <Glyph aria-hidden size={20} strokeWidth={1.75} />
          </div>
        )}
        <div className="grid gap-1.5 pr-6">
          <h2 className="text-lg font-semibold text-fg">{title}</h2>
          {description && <p className="text-sm text-fg-muted">{description}</p>}
        </div>
        {children}
      </div>
      {footer && (
        <div className="flex items-center justify-end gap-2 rounded-b-2xl border-t border-border bg-canvas-subtle px-6 py-4">
          {footer}
        </div>
      )}
      {onClose && (
        <IconButton icon={X} label="Close" size="sm" onClick={onClose} className="absolute top-4 right-4" />
      )}
    </div>
  )
  return overlay ? <Overlay>{panel}</Overlay> : panel
}
