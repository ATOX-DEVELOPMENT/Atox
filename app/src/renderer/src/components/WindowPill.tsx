import { PanelLeft } from 'lucide-react'
import { ToolbarButton } from './ToolbarButton'

interface WindowPillProps {
  /** Сайдбар открыт: таблетка стоит над ним и занимает его ширину; закрыт — сжимается до кнопок. */
  sidebarVisible: boolean
  onToggleSidebar(): void
}

/**
 * Верхняя таблетка сайдбара: слева место под кнопки окна macOS, справа — кнопка сайдбара. Она
 * остаётся на месте и когда сайдбар закрыт: за ней его открывают обратно.
 */
export function WindowPill({ sidebarVisible, onToggleSidebar }: WindowPillProps) {
  return (
    <div className="window-pill" data-collapsed={!sidebarVisible}>
      {/* Сами кнопки рисует macOS поверх этого места (`trafficLightPosition` у окна). */}
      <span className="window-pill__lights" aria-hidden />
      <ToolbarButton
        icon={PanelLeft}
        shortcut="toggleSidebar"
        label={sidebarVisible ? 'Hide sidebar' : 'Show sidebar'}
        onClick={onToggleSidebar}
      />
    </div>
  )
}
