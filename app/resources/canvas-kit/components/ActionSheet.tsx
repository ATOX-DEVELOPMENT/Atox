import type { LucideIcon } from 'lucide-react'
import { cn } from '../lib/cn'
import { Overlay } from './Overlay'

export interface ActionSheetAction {
  label: string
  icon?: LucideIcon
  destructive?: boolean
  onSelect?: () => void
}

export interface ActionSheetProps {
  title?: string
  message?: string
  actions: ActionSheetAction[]
  cancelLabel?: string
  onCancel?: () => void
  overlay?: boolean
  className?: string
}

/** Меню действий iOS снизу экрана: группа действий и отдельная кнопка отмены. */
export function ActionSheet({
  title,
  message,
  actions,
  cancelLabel = 'Cancel',
  onCancel,
  overlay = false,
  className
}: ActionSheetProps) {
  const row =
    'flex h-14 w-full cursor-pointer items-center justify-center gap-2 text-lg transition-colors hover:bg-muted'
  const panel = (
    <div className={cn('grid w-full gap-2 px-2 pb-[42px]', className)}>
      <div className="overflow-hidden rounded-2xl bg-surface-raised/95 backdrop-blur-xl">
        {(title || message) && (
          <div className="grid gap-1 border-b border-border px-4 py-3.5 text-center">
            {title && <p className="text-sm font-semibold text-fg-muted">{title}</p>}
            {message && <p className="text-sm text-fg-muted">{message}</p>}
          </div>
        )}
        {actions.map(({ label, icon: Glyph, destructive, onSelect }, index) => (
          <button
            key={label}
            type="button"
            onClick={onSelect}
            className={cn(
              row,
              index > 0 && 'border-t border-border',
              destructive ? 'text-danger-text' : 'text-accent-text'
            )}
          >
            {Glyph && <Glyph aria-hidden size={20} strokeWidth={1.75} />}
            {label}
          </button>
        ))}
      </div>
      <button type="button" onClick={onCancel} className={cn(row, 'rounded-2xl bg-surface-raised font-semibold text-accent-text')}>
        {cancelLabel}
      </button>
    </div>
  )
  return overlay ? <Overlay align="bottom">{panel}</Overlay> : panel
}
