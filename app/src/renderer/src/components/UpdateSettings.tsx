import { useEffect, useState } from 'react'
import { RELEASE_STAGE } from '../../../shared/release'
import type { UpdateCheckResult, UpdateState } from '../../../shared/update'
import { useUpdateState } from '../hooks/useUpdateState'
import { ipcErrorMessage } from '../lib/ipcError'

const { atox } = window

/** Чем закончилась последняя проверка, начатая кнопкой. */
type CheckStatus =
  | { kind: 'idle' }
  | { kind: 'checking' }
  | { kind: 'done'; result: UpdateCheckResult }
  | { kind: 'failed'; message: string }

/**
 * Строка с версией приложения и проверкой обновлений по кнопке; готовое обновление ставится
 * отсюда же. Карточку вокруг строки собирает страница настроек.
 */
export function UpdateSettings() {
  return __DEV_BUILD__ ? <DevBuildVersion /> : <ReleaseUpdateSettings />
}

/** Сборка для разработчика: версия с веткой и коммитом, обновлений нет. */
function DevBuildVersion() {
  return (
    <div className="settings__row">
      <span className="settings__label">
        <span>
          Atox {__APP_VERSION__} · Dev build ({__BUILD_BRANCH__} @ {__BUILD_COMMIT__})
        </span>
        <span className="settings__description">
          Dev builds don’t update automatically. Rebuild from pre-release to get changes.
        </span>
      </span>
    </div>
  )
}

/** Релизная сборка: версия и проверка обновлений. */
function ReleaseUpdateSettings() {
  const update = useUpdateState()
  const [version, setVersion] = useState<string | null>(null)
  const [status, setStatus] = useState<CheckStatus>({ kind: 'idle' })

  useEffect(() => {
    void atox.updates.currentVersion().then(setVersion)
  }, [])

  const check = async () => {
    setStatus({ kind: 'checking' })
    try {
      setStatus({ kind: 'done', result: await atox.updates.check() })
    } catch (error) {
      setStatus({ kind: 'failed', message: ipcErrorMessage(error) })
    }
  }

  return (
    <div className="settings__row">
      <span className="settings__label">
        <span>
          Atox {version} {RELEASE_STAGE}
        </span>
        <span className="settings__description" aria-live="polite">
          {describe(update, status)}
        </span>
      </span>
      {update?.phase === 'ready' ? (
        <button
          type="button"
          className="settings__button settings__button--primary"
          onClick={() => atox.updates.install()}
        >
          Restart to Update
        </button>
      ) : (
        <button
          type="button"
          className="settings__button"
          disabled={status.kind === 'checking' || update?.phase === 'downloading'}
          onClick={() => void check()}
        >
          Check for Updates
        </button>
      )}
    </div>
  )
}

/** Подпись под версией: что с обновлением сейчас важнее того, чем закончилась проверка. */
function describe(update: UpdateState, status: CheckStatus): string {
  if (update?.phase === 'downloading') {
    return `Downloading Atox ${update.version}… ${Math.round(update.progress * 100)}%`
  }
  if (update?.phase === 'ready') {
    return `Atox ${update.version} is ready to install.`
  }
  switch (status.kind) {
    case 'checking':
      return 'Checking for updates…'
    case 'failed':
      return `Couldn’t check for updates: ${status.message}`
    case 'done':
      return status.result === 'unsupported'
        ? 'Atox can’t update itself here. Move it to the Applications folder.'
        : 'You’re up to date.'
    case 'idle':
      return 'New versions download automatically.'
  }
}
