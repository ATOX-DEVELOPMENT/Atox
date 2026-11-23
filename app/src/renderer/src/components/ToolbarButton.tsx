import type { LucideIcon } from 'lucide-react'
import { formatShortcut, type ShortcutId } from '../../../shared/shortcuts'
import { useSettings } from '../hooks/SettingsContext'

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

/** Квадратная кнопка с иконкой для панелей окна: подсказка показывает горячую клавишу. */
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
  return (
    <button
      type="button"
      className="workspace-toolbar__button"
      data-active={active}
      aria-label={label}
      aria-pressed={active}
      title={keys ? `${label} (${keys})` : label}
      disabled={disabled}
      onClick={onClick}
    >
      <Icon className="icon" />
      {badge !== undefined && <span className="workspace-toolbar__badge">{badge}</span>}
    </button>
  )
}
