import { useEffect, useState } from 'react'
import {
  Archive,
  ChartNoAxesColumn,
  Keyboard,
  Palette,
  Plug,
  Puzzle,
  SlidersHorizontal,
  Sparkles,
  X,
  type LucideIcon
} from 'lucide-react'
import { isIntegrationKind, type IntegrationKind } from '../../../shared/integrations'
import { useProjectsContext } from '../hooks/ProjectsContext'
import { useIntegrationLists } from '../hooks/useIntegrationLists'
import { AgentIntegrations } from './AgentIntegrations'
import { ArchivedChats } from './ArchivedChats'
import { GitHubMark } from './GitHubMark'
import { GitHubSettings } from './GitHubSettings'
import { SettingsAppearance } from './SettingsAppearance'
import { SettingsGeneral } from './SettingsGeneral'
import { ShortcutList } from './ShortcutList'
import { UsageSettings } from './UsageSettings'

type SettingsSection =
  'general' | 'appearance' | 'shortcuts' | 'usage' | 'github' | 'archived' | IntegrationKind

interface SectionItem {
  id: SettingsSection
  label: string
  icon: LucideIcon | typeof GitHubMark
}

/** Разделы окна настроек, сгруппированные в списке слева; у группы может не быть названия. */
const SECTION_GROUPS: ReadonlyArray<{ title?: string; items: ReadonlyArray<SectionItem> }> = [
  {
    items: [
      { id: 'general', label: 'General', icon: SlidersHorizontal },
      { id: 'appearance', label: 'Appearance', icon: Palette },
      { id: 'shortcuts', label: 'Shortcuts', icon: Keyboard }
    ]
  },
  {
    title: 'Agents',
    items: [
      { id: 'plugins', label: 'Plugins', icon: Puzzle },
      { id: 'skills', label: 'Skills', icon: Sparkles },
      { id: 'mcp', label: 'MCP', icon: Plug }
    ]
  },
  {
    title: 'Account',
    items: [
      { id: 'usage', label: 'Usage', icon: ChartNoAxesColumn },
      { id: 'github', label: 'GitHub', icon: GitHubMark },
      { id: 'archived', label: 'Archive', icon: Archive }
    ]
  }
]

const SECTIONS = SECTION_GROUPS.flatMap(({ items }) => items)

interface SettingsViewProps {
  onClose(): void
}

/**
 * Окно настроек поверх приложения: слева список разделов, справа выбранный раздел. Клик за
 * окном и Esc закрывают его.
 */
export function SettingsView({ onClose }: SettingsViewProps) {
  const { projects, currentProjectId } = useProjectsContext()
  const project = projects.find(({ id }) => id === currentProjectId) ?? null
  const integrations = useIntegrationLists(project?.id ?? null)
  const [section, setSection] = useState<SettingsSection>('general')
  const current = SECTIONS.find(({ id }) => id === section) ?? SECTIONS[0]

  useEffect(() => {
    // Esc, который уже обработало поле, окно кадрирования или переименование, окно не закрывает.
    const closeOnEscape = (event: globalThis.KeyboardEvent) => {
      if (event.key === 'Escape' && !event.defaultPrevented) {
        onClose()
      }
    }
    window.addEventListener('keydown', closeOnEscape)
    return () => window.removeEventListener('keydown', closeOnEscape)
  }, [onClose])

  return (
    <div className="modal settings-modal" role="presentation" onMouseDown={onClose}>
      <div
        className="modal__dialog settings-dialog"
        role="dialog"
        aria-modal="true"
        aria-labelledby="settings-title"
        onMouseDown={(event) => event.stopPropagation()}
      >
        <nav className="settings-nav" aria-label="Settings sections">
          {SECTION_GROUPS.map(({ title, items }) => (
            <div key={title ?? 'main'} className="settings-nav__group">
              {title && <h2 className="settings-nav__title">{title}</h2>}
              {items.map(({ id, label, icon: Icon }) => (
                <button
                  key={id}
                  type="button"
                  className="settings-nav__item"
                  aria-current={section === id ? 'page' : undefined}
                  onClick={() => setSection(id)}
                  // Агенты отвечают по нескольку секунд: спрашиваем, как только курсор над разделом.
                  onPointerEnter={() => isIntegrationKind(id) && integrations.load(id)}
                >
                  <Icon className="settings-nav__icon" />
                  {label}
                </button>
              ))}
            </div>
          ))}
        </nav>

        <div className="settings-main">
          <header className="settings-main__header">
            <h1 id="settings-title" className="settings-main__title">
              <span className="settings-main__crumb">Settings</span>
              <span className="settings-main__crumb" aria-hidden>
                /
              </span>
              {current.label}
            </h1>
            <button
              type="button"
              className="icon-button"
              aria-label="Close settings"
              onClick={onClose}
            >
              <X className="icon" />
            </button>
          </header>

          <div className="settings-main__body">
            {section === 'general' ? (
              <SettingsGeneral />
            ) : section === 'appearance' ? (
              <SettingsAppearance />
            ) : section === 'shortcuts' ? (
              <div className="settings__group">
                <ShortcutList />
              </div>
            ) : section === 'usage' ? (
              <UsageSettings />
            ) : section === 'github' ? (
              <GitHubSettings />
            ) : section === 'archived' ? (
              <ArchivedChats />
            ) : (
              <AgentIntegrations
                // Фильтр у каждого раздела свой.
                key={section}
                kind={section}
                lists={integrations}
                projectName={project?.name ?? null}
              />
            )}
          </div>
        </div>
      </div>
    </div>
  )
}
