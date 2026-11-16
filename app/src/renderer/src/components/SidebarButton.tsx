import type { LucideIcon } from 'lucide-react'
import { useSettings } from '../hooks/SettingsContext'

interface SidebarButtonProps {
  icon: LucideIcon
  label: string
  /** Кнопка открытой сейчас страницы. */
  active?: boolean
  disabled?: boolean
  onClick(): void
}

export function SidebarButton({
  icon: Icon,
  label,
  active = false,
  disabled,
  onClick
}: SidebarButtonProps) {
  const { sidebarButtons } = useSettings()
  const withLabel = sidebarButtons === 'list'

  return (
    <button
      type="button"
      className="sidebar-button"
      data-active={active}
      aria-pressed={active}
      // Без подписи имя кнопки — в подсказке; рядом с подписью подсказка только повторяла бы её.
      aria-label={withLabel ? undefined : label}
      title={withLabel ? undefined : label}
      disabled={disabled}
      onClick={onClick}
    >
      <Icon className="icon" />
      {withLabel && <span className="sidebar-button__label">{label}</span>}
    </button>
  )
}
