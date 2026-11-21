import { useEffect, useRef, useState } from 'react'
import {
  Archive,
  Camera,
  ChartNoAxesColumn,
  LayoutGrid,
  List,
  Monitor,
  Moon,
  Plug,
  Puzzle,
  SlidersHorizontal,
  Sparkles,
  Sun,
  Trash2,
  X,
  type LucideIcon
} from 'lucide-react'
import { isIntegrationKind, type IntegrationKind } from '../../../shared/integrations'
import { useProjectsContext } from '../hooks/ProjectsContext'
import { useSettings } from '../hooks/SettingsContext'
import { useUserProfile } from '../hooks/useUserProfile'
import {
  ACCENTS,
  PROFILE_NAME_MAX_LENGTH,
  type SidebarButtonStyle,
  type ThemeMode
} from '../../../shared/settings'
import { useIntegrationLists } from '../hooks/useIntegrationLists'
import { playChime } from '../lib/chime'
import { AvatarCropDialog } from './AvatarCropDialog'
import { ProfileAvatar } from './ProfileAvatar'
import { AgentIntegrations } from './AgentIntegrations'
import { ArchivedChats } from './ArchivedChats'
import { GitHubMark } from './GitHubMark'
import { GitHubSettings } from './GitHubSettings'
import { ShortcutList } from './ShortcutList'
import { UpdateSettings } from './UpdateSettings'
import { UsageSettings } from './UsageSettings'

const { atox } = window

type SettingsSection = 'general' | 'usage' | 'github' | IntegrationKind | 'archived'

/** Разделы настроек: общие, расход токенов, архив чатов и то, чем пользуются агенты, — по одному списку на вид. */
const SECTIONS: ReadonlyArray<{
  id: SettingsSection
  label: string
  icon: LucideIcon | typeof GitHubMark
}> = [
  { id: 'general', label: 'General', icon: SlidersHorizontal },
  { id: 'usage', label: 'Usage', icon: ChartNoAxesColumn },
  { id: 'archived', label: 'Archive', icon: Archive },
  { id: 'github', label: 'GitHub', icon: GitHubMark },
  { id: 'plugins', label: 'Plugins', icon: Puzzle },
  { id: 'skills', label: 'Skills', icon: Sparkles },
  { id: 'mcp', label: 'MCP', icon: Plug }
]

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

interface SettingsViewProps {
  onClose(): void
}

export function SettingsView({ onClose }: SettingsViewProps) {
  const { shareUsageStats, playSounds, profileName, profileAvatar, theme, accent, sidebarButtons } =
    useSettings()
  const profile = useUserProfile()
  const { projects, currentProjectId } = useProjectsContext()
  const project = projects.find(({ id }) => id === currentProjectId) ?? null
  const integrations = useIntegrationLists(project?.id ?? null)
  const [section, setSection] = useState<SettingsSection>('general')
  const [avatarFile, setAvatarFile] = useState<File | null>(null)
  const avatarInput = useRef<HTMLInputElement>(null)

  useEffect(() => {
    // Esc, который уже обработало поле (переименование, поиск), страницу не закрывает.
    const closeOnEscape = (event: globalThis.KeyboardEvent) => {
      if (event.key === 'Escape' && !event.defaultPrevented) {
        onClose()
      }
    }
    window.addEventListener('keydown', closeOnEscape)
    return () => window.removeEventListener('keydown', closeOnEscape)
  }, [onClose])

  return (
    <section className="settings" aria-labelledby="settings-title">
      <header className="settings__header">
        <h1 id="settings-title" className="settings__title">
          Settings
        </h1>
        <button type="button" className="icon-button" aria-label="Close settings" onClick={onClose}>
          <X className="icon" />
        </button>
      </header>

      <div className="settings__group settings__tabs">
        <div className="segmented" role="tablist" aria-label="Section">
          {SECTIONS.map(({ id, label, icon: Icon }) => (
            <button
              key={id}
              type="button"
              role="tab"
              className="segmented__item"
              aria-selected={section === id}
              onClick={() => setSection(id)}
              // Агенты отвечают по нескольку секунд: спрашиваем, как только курсор над разделом.
              onPointerEnter={() => isIntegrationKind(id) && integrations.load(id)}
            >
              <Icon className="segmented__icon" />
              {label}
            </button>
          ))}
        </div>
      </div>

      {section === 'general' ? (
        <>
          <div className="settings__group">
            <div className="settings__card">
              <div className="settings__row">
                <span className="settings__label">
                  <span>Photo</span>
                  <span className="settings__description">
                    Shown next to your name in the sidebar.
                  </span>
                </span>
                <span className="settings__avatar">
                  <ProfileAvatar
                    image={profileAvatar}
                    name={profileName.trim() || profile?.name}
                    large
                  />
                  <input
                    ref={avatarInput}
                    type="file"
                    accept="image/*"
                    hidden
                    onChange={(event) => {
                      setAvatarFile(event.target.files?.[0] ?? null)
                      // Тот же файл можно выбрать снова, например после отмены.
                      event.target.value = ''
                    }}
                  />
                  <button
                    type="button"
                    className="icon-button"
                    aria-label={profileAvatar ? 'Change photo' : 'Choose photo'}
                    title={profileAvatar ? 'Change photo' : 'Choose photo'}
                    onClick={() => avatarInput.current?.click()}
                  >
                    <Camera className="icon" />
                  </button>
                  {profileAvatar && (
                    <button
                      type="button"
                      className="icon-button"
                      aria-label="Remove photo"
                      title="Remove photo"
                      onClick={() => void atox.settings.update({ profileAvatar: '' })}
                    >
                      <Trash2 className="icon" />
                    </button>
                  )}
                </span>
              </div>
              <label className="settings__row">
                <span className="settings__label">
                  <span>Name</span>
                  <span className="settings__description">
                    Shown in the sidebar. Leave empty to use your git or Mac name.
                  </span>
                </span>
                <input
                  type="text"
                  className="settings__text-input"
                  value={profileName}
                  maxLength={PROFILE_NAME_MAX_LENGTH}
                  placeholder={profile?.name}
                  spellCheck={false}
                  onChange={(event) =>
                    void atox.settings.update({
                      profileName: event.target.value
                    })
                  }
                />
              </label>
              <UpdateSettings />
              <label className="settings__row">
                <span className="settings__label">
                  <span>Play sounds</span>
                  <span className="settings__description">
                    A soft chime when an agent finishes or needs you.
                  </span>
                </span>
                <input
                  type="checkbox"
                  role="switch"
                  className="switch"
                  checked={playSounds}
                  onChange={(event) => {
                    const enabled = event.target.checked
                    // Включённый звук сразу проигрывается: так слышно, каким он будет.
                    if (enabled) {
                      playChime('done')
                    }
                    void atox.settings.update({ playSounds: enabled })
                  }}
                />
              </label>
              <label className="settings__row">
                <span className="settings__label">
                  <span>Share anonymous usage stats</span>
                  <span className="settings__description">
                    Only app version and OS, once a day. No projects, chats or personal data.
                  </span>
                </span>
                <input
                  type="checkbox"
                  role="switch"
                  className="switch"
                  checked={shareUsageStats}
                  onChange={(event) =>
                    void atox.settings.update({
                      shareUsageStats: event.target.checked
                    })
                  }
                />
              </label>
            </div>
          </div>

          <div className="settings__group">
            <section className="settings__subgroup" aria-label="Appearance">
              <h3 className="settings__subgroup-title">Appearance</h3>
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
            </section>
          </div>

          <div className="settings__group">
            <ShortcutList />
          </div>
        </>
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
      {avatarFile && (
        <AvatarCropDialog
          file={avatarFile}
          onSave={(avatar) => {
            void atox.settings.update({ profileAvatar: avatar })
            setAvatarFile(null)
          }}
          onClose={() => setAvatarFile(null)}
        />
      )}
    </section>
  )
}
