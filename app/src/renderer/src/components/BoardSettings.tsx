import { Minus, Plus } from 'lucide-react'
import { BOARD_AGENTS } from '../../../shared/board'
import { useSettings } from '../hooks/SettingsContext'
import { TaskAgentPicker } from './TaskAgentPicker'

const { atox } = window

/** Раздел настроек доски: какой агент берёт задачи и сколько агентов работают сразу. */
export function BoardSettings() {
  const { boardMaxAgents, boardAgent } = useSettings()
  const setMaxAgents = (value: number) => void atox.settings.update({ boardMaxAgents: value })

  return (
    <div className="settings__group">
      <div className="settings__subgroup">
        <h2 className="settings__subgroup-title">Tasks</h2>
        <div className="settings__card">
          <div className="settings__row settings__row--stacked">
            <span className="settings__label">
              <span>Agent for tasks</span>
              <span className="settings__description">
                Suggested when you start a task. You can pick another one for each task.
              </span>
            </span>
            <TaskAgentPicker
              value={boardAgent}
              onChange={(value) => void atox.settings.update({ boardAgent: value })}
            />
          </div>
          <div className="settings__row">
            <span className="settings__label">
              <span>Agents at once</span>
              <span className="settings__description">
                Queued tasks wait until one of the running agents finishes.
              </span>
            </span>
            <div className="stepper" role="group" aria-label="Agents at once">
              <button
                type="button"
                className="stepper__button"
                aria-label="Fewer agents"
                disabled={boardMaxAgents <= BOARD_AGENTS.min}
                onClick={() => setMaxAgents(boardMaxAgents - 1)}
              >
                <Minus className="stepper__icon" />
              </button>
              <span className="stepper__value" aria-live="polite">
                {boardMaxAgents}
              </span>
              <button
                type="button"
                className="stepper__button"
                aria-label="More agents"
                disabled={boardMaxAgents >= BOARD_AGENTS.max}
                onClick={() => setMaxAgents(boardMaxAgents + 1)}
              >
                <Plus className="stepper__icon" />
              </button>
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}
