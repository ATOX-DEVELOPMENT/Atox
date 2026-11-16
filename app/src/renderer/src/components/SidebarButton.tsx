import type { LucideIcon } from 'lucide-react'
import { useSettings } from '../hooks/SettingsContext'

interface SidebarButtonProps {
  icon: LucideIcon
  label: string
  /** Число справа от подписи, например сколько холстов; без подписи — только в подсказке. */
  count?: number
  /** Кнопка открытой сейчас страницы. */
  active?: boolean
  disabled?: boolean
  onClick(): void
}

export function SidebarButton({
  icon: Icon,
  label,
  count,
  active = false,
  disabled,
  onClick
}: SidebarButtonProps) {
  const { sidebarButtons } = useSettings()
  const withLabel = sidebarButtons === 'list'
  const hint = count === undefined ? label : `${label} (${count})`

  return (
    <button
      type="button"
      className="sidebar-button"
      data-active={active}
      aria-pressed={active}
      // Без подписи имя кнопки — в подсказке; рядом с подписью подсказка только повторяла бы её.
      aria-label={withLabel ? undefined : hint}
      title={withLabel ? undefined : hint}
      disabled={disabled}
      onClick={onClick}
    >
      <Icon className="icon" />
      {withLabel && <span className="sidebar-button__label">{label}</span>}
      {withLabel && count !== undefined && <span className="sidebar-button__count">{count}</span>}
    </button>
  )
}
