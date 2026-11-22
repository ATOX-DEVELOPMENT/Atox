import { useRef, useState } from 'react'
import { Camera, Trash2 } from 'lucide-react'
import { PROFILE_NAME_MAX_LENGTH } from '../../../shared/settings'
import { useSettings } from '../hooks/SettingsContext'
import { useUserProfile } from '../hooks/useUserProfile'
import { playChime } from '../lib/chime'
import { AvatarCropDialog } from './AvatarCropDialog'
import { ProfileAvatar } from './ProfileAvatar'
import { UpdateSettings } from './UpdateSettings'

const { atox } = window

/** Раздел «General»: профиль в сайдбаре и поведение самого приложения. */
export function SettingsGeneral() {
  const { shareUsageStats, playSounds, profileName, profileAvatar } = useSettings()
  const profile = useUserProfile()
  const [avatarFile, setAvatarFile] = useState<File | null>(null)
  const avatarInput = useRef<HTMLInputElement>(null)

  return (
    <>
      <div className="settings__group">
        <section className="settings__subgroup" aria-label="Profile">
          <h3 className="settings__subgroup-title">Profile</h3>
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
                onChange={(event) => void atox.settings.update({ profileName: event.target.value })}
              />
            </label>
          </div>
        </section>
      </div>

      <div className="settings__group">
        <section className="settings__subgroup" aria-label="Application">
          <h3 className="settings__subgroup-title">Application</h3>
          <div className="settings__card">
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
                  void atox.settings.update({ shareUsageStats: event.target.checked })
                }
              />
            </label>
          </div>
        </section>
      </div>

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
    </>
  )
}
