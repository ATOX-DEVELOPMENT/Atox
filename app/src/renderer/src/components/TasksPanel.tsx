import { useState, type CSSProperties } from 'react'
import { CircleAlert, LoaderCircle, Square } from 'lucide-react'
import type { BackgroundTask } from '../../../shared/conversation'
import { TERMINAL_WIDTH } from '../../../shared/settings'
import { useSettings } from '../hooks/SettingsContext'
import { useStopTask } from '../hooks/useStopTask'
import { BACKGROUND_TASK_ICONS, BACKGROUND_TASK_LABELS } from './BackgroundTasks'
import { PanelResizer } from './PanelResizer'

const { atox } = window

interface TasksPanelProps {
  chatId: string | null
  tasks: readonly BackgroundTask[]
}

/**
 * Панель справа от чатов: что агент текущего чата оставил работать в фоне — команды,
 * помощников, слежение за CI. Его ответ может уже закончиться, а работа идёт.
 */
export function TasksPanel({ chatId, tasks }: TasksPanelProps) {
  const { terminalWidth } = useSettings()
  const { stopping, errors, stop } = useStopTask(chatId, tasks)
  const [draftWidth, setDraftWidth] = useState<number | null>(null)
  const width = draftWidth ?? terminalWidth

  return (
    <aside className="changes-panel" style={{ '--terminal-width': `${width}px` } as CSSProperties}>
      <header className="changes-panel__header">
        <h2 className="changes-panel__title">Background tasks</h2>
        {tasks.length > 0 && <span className="changes-panel__count">{tasks.length}</span>}
      </header>
      <div className="changes-panel__body">
        {tasks.length === 0 ? (
          <p className="changes-panel__message">
            Nothing is running in the background. Long commands, helper agents and waiting for
            CI show up here while they run.
          </p>
        ) : (
          <ul className="task-list">
            {tasks.map(({ id, kind, description, stoppable }) => {
              const Icon = BACKGROUND_TASK_ICONS[kind]
              const error = errors.get(id)
              return (
                <li key={id} className="task-list__item">
                  <Icon className="task-list__icon" aria-hidden />
                  <span className="task-list__text">
                    <span className="task-list__description">{description}</span>
                    <span className="task-list__kind">{BACKGROUND_TASK_LABELS[kind]}</span>
                    {error && (
                      <span className="task-list__error" role="alert">
                        <CircleAlert className="task-list__error-icon" aria-hidden />
                        {error}
                      </span>
                    )}
                  </span>
                  <span className="task-list__action">
                    <LoaderCircle
                      className="task-list__spinner"
                      aria-label={stopping.has(id) ? 'Stopping' : 'Running'}
                    />
                    {stoppable && !stopping.has(id) && (
                      <button
                        type="button"
                        className="task-list__stop"
                        aria-label={`Stop: ${description}`}
                        title="Stop"
                        onClick={() => stop(id)}
                      >
                        <Square className="task-list__stop-icon" aria-hidden />
                      </button>
                    )}
                  </span>
                </li>
              )
            })}
          </ul>
        )}
      </div>
      <PanelResizer
        width={width}
        bounds={TERMINAL_WIDTH}
        edge="left"
        label="Resize tasks"
        onDrag={setDraftWidth}
        onCommit={(next) => atox.settings.update({ terminalWidth: next })}
      />
    </aside>
  )
}
