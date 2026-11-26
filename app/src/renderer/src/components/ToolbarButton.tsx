import type { LucideIcon } from 'lucide-react'
import { formatShortcut, type ShortcutId } from '../../../shared/shortcuts'
import { useSettings } from '../hooks/SettingsContext'
import { HoverHint, useHoverHint } from './HoverHint'

interface ToolbarButtonProps {
  icon: LucideIcon
  shortcut: ShortcutId
  label: string
  /** Кнопка открытой сейчас панели. */
  active?: boolean
  disabled?: boolean
  /** Число на кнопке — например, сколько задач идёт. */
  badge?: number
  onClick(): void
}

/**
 * Квадратная кнопка с иконкой для панелей окна. При наведении — подпись с горячей клавишей,
 * как у кнопок сайдбара; кнопки стоят у верха окна, поэтому подпись под кнопкой.
 */
export function ToolbarButton({
  icon: Icon,
  shortcut,
  label,
  active = false,
  disabled,
  badge,
  onClick
}: ToolbarButtonProps) {
  const { shortcuts } = useSettings()
  const keys = formatShortcut(shortcut, shortcuts)
  const hint = useHoverHint()
  return (
    <button
      type="button"
      className="workspace-toolbar__button"
      data-active={active}
      aria-label={label}
      aria-pressed={active}
      disabled={disabled}
      onClick={() => {
        hint.hide()
        onClick()
      }}
      onMouseEnter={(event) => hint.show(event.currentTarget)}
      onMouseLeave={hint.hide}
    >
      <Icon className="icon" />
      {badge !== undefined && <span className="workspace-toolbar__badge">{badge}</span>}
      {hint.anchor && (
        <HoverHint anchor={hint.anchor} placement="below">
          {keys ? `${label} (${keys})` : label}
        </HoverHint>
      )}
    </button>
  )
}
