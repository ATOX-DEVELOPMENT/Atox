import { useEffect, useState } from 'react'
import type { CanvasScreen, ScreenVersion } from '../../../../shared/canvas'
import { ipcErrorMessage } from '../../lib/ipcError'
import { formatFullDate } from '../../lib/relativeTime'

const CAUSE_LABELS: Record<ScreenVersion['cause'], string> = {
  created: 'Created',
  edit: 'Agent',
  restore: 'Restored'
}

/** Что было, если правка не по просьбе человека и текста просьбы нет. */
const CAUSE_DESCRIPTIONS: Record<ScreenVersion['cause'], string> = {
  created: 'Screen created',
  edit: 'Changed by the agent',
  restore: 'An older version restored'
}

const TIME = new Intl.DateTimeFormat('en', { hour: '2-digit', minute: '2-digit' })
const DATE_TIME = new Intl.DateTimeFormat('en', {
  month: 'short',
  day: 'numeric',
  hour: '2-digit',
  minute: '2-digit'
})

/** Сегодняшняя версия — только время, более старая — с датой. */
function formatSavedAt(timestamp: number): string {
  const sameDay = new Date(timestamp).toDateString() === new Date().toDateString()
  return (sameDay ? TIME : DATE_TIME).format(timestamp)
}

interface HistoryDrawerProps {
  canvasId: string
  canvasName: string
  screens: readonly CanvasScreen[]
  screenId: string
  onScreenChange(screenId: string): void
  /** Версия, которую сейчас показывает экран; `null` — текущая. */
  previewVersionId: string | null
  onPreview(versionId: string | null): void
}

type Versions =
  | { status: 'loading' }
  | { status: 'loaded'; versions: ScreenVersion[] }
  | { status: 'failed'; message: string }

/**
 * История экрана: версии, которые приложение сохранило при каждом изменении его файла.
 * Клик по старой версии показывает её на холсте, «Restore» возвращает её в файл.
 */
export function HistoryDrawer({
  canvasId,
  canvasName,
  screens,
  screenId,
  onScreenChange,
  previewVersionId,
  onPreview
}: HistoryDrawerProps) {
  const screen = screens.find(({ id }) => id === screenId)
  const revision = screen?.revision
  const [versions, setVersions] = useState<Versions>({ status: 'loading' })
  const [confirmingId, setConfirmingId] = useState<string | null>(null)
  const [restoringId, setRestoringId] = useState<string | null>(null)

  // Новая правка файла — новая версия: список перечитывается.
  useEffect(() => {
    let current = true
    setConfirmingId(null)
    void window.atox.canvas.history(canvasId, screenId).then(
      (loaded) => {
        if (current) {
          setVersions({
            status: 'loaded',
            versions: [...loaded].sort((a, b) => b.savedAt - a.savedAt)
          })
        }
      },
      (error: unknown) => {
        if (current) {
          setVersions({ status: 'failed', message: ipcErrorMessage(error) })
        }
      }
    )
    return () => {
      current = false
    }
  }, [canvasId, screenId, revision])

  const restore = async (versionId: string) => {
    setRestoringId(versionId)
    try {
      await window.atox.canvas.restore(canvasId, screenId, versionId)
      onPreview(null)
    } catch (error) {
      setVersions({ status: 'failed', message: ipcErrorMessage(error) })
    } finally {
      setRestoringId(null)
      setConfirmingId(null)
    }
  }

  return (
    <aside className="history-drawer" aria-label="History">
      <header className="history-drawer__header">
        <h2 className="history-drawer__title">History</h2>
        <span className="history-drawer__canvas">{canvasName}</span>
      </header>
      <div className="history-drawer__screens">
        <div className="segmented segmented--small" role="tablist" aria-label="Screen">
          {screens.map(({ id, name }) => (
            <button
              key={id}
              type="button"
              role="tab"
              className="segmented__item"
              aria-selected={id === screenId}
              title={name}
              onClick={() => onScreenChange(id)}
            >
              <span className="history-drawer__screen-name">{name}</span>
            </button>
          ))}
        </div>
      </div>
      <div className="history-drawer__body">
        {versions.status === 'failed' && (
          <p className="history-drawer__message" role="alert">
            {versions.message}
          </p>
        )}
        {versions.status === 'loaded' && versions.versions.length === 0 && (
          <p className="history-drawer__message">No saved versions yet</p>
        )}
        {versions.status === 'loaded' && (
          <ol className="history-drawer__list">
            {versions.versions.map((version, index) => {
              const current = index === 0
              const previewed = current ? previewVersionId === null : previewVersionId === version.id
              return (
                <li key={version.id} className="version" data-current={current}>
                  <button
                    type="button"
                    className="version__main"
                    aria-pressed={previewed}
                    aria-label={`Show the version from ${formatFullDate(version.savedAt)}`}
                    onClick={() => onPreview(current ? null : version.id)}
                  >
                    <span className="version__meta">
                      {current && <span className="version__badge version__badge--current">Current</span>}
                      <span className="version__badge">{CAUSE_LABELS[version.cause]}</span>
                      <time dateTime={new Date(version.savedAt).toISOString()} title={formatFullDate(version.savedAt)}>
                        {formatSavedAt(version.savedAt)}
                      </time>
                    </span>
                    <span className="version__text">
                      {version.fix ?? CAUSE_DESCRIPTIONS[version.cause]}
                    </span>
                  </button>
                  {!current &&
                    (confirmingId === version.id ? (
                      <div className="version__actions" role="group" aria-label="Restore this version">
                        <span className="version__question">Replace the current file?</span>
                        <button
                          type="button"
                          className="canvas-button canvas-button--primary"
                          disabled={restoringId !== null}
                          onClick={() => void restore(version.id)}
                        >
                          {restoringId === version.id ? 'Restoring…' : 'Restore'}
                        </button>
                        <button
                          type="button"
                          className="canvas-button"
                          onClick={() => setConfirmingId(null)}
                        >
                          Cancel
                        </button>
                      </div>
                    ) : (
                      <div className="version__actions">
                        <button
                          type="button"
                          className="canvas-button"
                          onClick={() => setConfirmingId(version.id)}
                        >
                          Restore
                        </button>
                      </div>
                    ))}
                </li>
              )
            })}
          </ol>
        )}
      </div>
    </aside>
  )
}
