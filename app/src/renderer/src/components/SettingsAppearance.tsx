import { LayoutGrid, List, Monitor, Moon, Sun, type LucideIcon } from 'lucide-react'
import { ACCENTS, type SidebarButtonStyle, type ThemeMode } from '../../../shared/settings'
import { useSettings } from '../hooks/SettingsContext'

const { atox } = window

const THEME_OPTIONS: ReadonlyArray<{
  id: ThemeMode
  label: string
  icon: LucideIcon
}> = [
  { id: 'system', label: 'System', icon: Monitor },
  { id: 'light', label: 'Light', icon: Sun },
  { id: 'dark', label: 'Dark', icon: Moon }
]

const SIDEBAR_BUTTON_OPTIONS: ReadonlyArray<{
  id: SidebarButtonStyle
  label: string
  icon: LucideIcon
}> = [
  { id: 'list', label: 'List', icon: List },
  { id: 'icons', label: 'Icons', icon: LayoutGrid }
]

/** Раздел «Appearance»: тема, вид кнопок сайдбара и акцентный цвет. */
export function SettingsAppearance() {
  const { theme, accent, sidebarButtons } = useSettings()

  return (
    <div className="settings__group">
      <div className="settings__card">
        <div className="settings__row">
          <span className="settings__label">
            <span>Theme</span>
            <span className="settings__description">
              Follow the system or always use a light or dark window.
            </span>
          </span>
          <div className="segmented" role="radiogroup" aria-label="Appearance">
            {THEME_OPTIONS.map(({ id, label, icon: Icon }) => (
              <button
                key={id}
                type="button"
                role="radio"
                aria-checked={theme === id}
                className="segmented__item"
                onClick={() => void atox.settings.update({ theme: id })}
              >
                <Icon className="segmented__icon" />
                {label}
              </button>
            ))}
          </div>
        </div>
        <div className="settings__row">
          <span className="settings__label">
            <span>Sidebar buttons</span>
            <span className="settings__description">
              Show the buttons above the projects as rows with labels or as a row of icons.
            </span>
          </span>
          <div className="segmented" role="radiogroup" aria-label="Sidebar buttons">
            {SIDEBAR_BUTTON_OPTIONS.map(({ id, label, icon: Icon }) => (
              <button
                key={id}
                type="button"
                role="radio"
                aria-checked={sidebarButtons === id}
                className="segmented__item"
                onClick={() => void atox.settings.update({ sidebarButtons: id })}
              >
                <Icon className="segmented__icon" />
                {label}
              </button>
            ))}
          </div>
        </div>
        <div className="settings__row">
          <span className="settings__label">
            <span>Accent color</span>
            <span className="settings__description">
              Used for selections, switches and buttons.
            </span>
          </span>
          <div className="accent-swatches" role="radiogroup" aria-label="Accent color">
            {ACCENTS.map(({ id, name }) => (
              <button
                key={id}
                type="button"
                role="radio"
                aria-checked={accent === id}
                aria-label={name}
                title={name}
                data-accent={id}
                className="accent-swatch"
                onClick={() => void atox.settings.update({ accent: id })}
              />
            ))}
          </div>
        </div>
      </div>
    </div>
  )
}
