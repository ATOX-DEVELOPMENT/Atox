import type { LucideIcon } from 'lucide-react'
import { useState } from 'react'
import { createPortal } from 'react-dom'
import { useSettings } from '../hooks/SettingsContext'

/** Где показать подсказку: над кнопкой, по её центру. */
interface HintPosition {
  x: number
  y: number
}

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
  const [hintAt, setHintAt] = useState<HintPosition | null>(null)
  const showHint = (button: HTMLElement) => {
    const rect = button.getBoundingClientRect()
    setHintAt({ x: rect.left + rect.width / 2, y: rect.top })
  }

  return (
    <button
      type="button"
      className="sidebar-button"
      data-active={active}
      aria-pressed={active}
      // Без подписи имя кнопки — в подсказке; рядом с подписью подсказка только повторяла бы её.
      aria-label={withLabel ? undefined : hint}
      disabled={disabled}
      onClick={() => {
        setHintAt(null)
        onClick()
      }}
      onMouseEnter={withLabel ? undefined : (event) => showHint(event.currentTarget)}
      onMouseLeave={() => setHintAt(null)}
    >
      <Icon className="icon" />
      {withLabel && <span className="sidebar-button__label">{label}</span>}
      {withLabel && count !== undefined && <span className="sidebar-button__count">{count}</span>}
      {/* Сайдбар обрезает всё, что выходит за его края, — подсказка рисуется поверх окна. */}
      {!withLabel &&
        hintAt &&
        createPortal(
          <span
            className="sidebar-hint"
            role="tooltip"
            style={{ left: hintAt.x, top: hintAt.y }}
          >
            {hint}
          </span>,
          document.body
        )}
    </button>
  )
}
