import { Minus, Plus } from 'lucide-react'
import { BOARD_AGENTS, BOARD_POLL_SECONDS, BOARD_ROUNDS } from '../../../shared/board'
import { useSettings } from '../hooks/SettingsContext'
import { TaskAgentPicker } from './TaskAgentPicker'

const { atox } = window

/** «Без предела» в счётчике агентов — шаг после самого большого предела. */
const UNLIMITED_AGENTS_STEP = BOARD_AGENTS.max + 1

interface StepperProps {
  label: string
  value: number
  min: number
  max: number
  step?: number
  /** Подпись значения: «60 s». */
  format?(value: number): string
  onChange(value: number): void
}

/** Число с кнопками «меньше» и «больше». */
function Stepper({ label, value, min, max, step = 1, format, onChange }: StepperProps) {
  return (
    <div className="stepper" role="group" aria-label={label}>
      <button
        type="button"
        className="stepper__button"
        aria-label={`Decrease: ${label}`}
        disabled={value <= min}
        onClick={() => onChange(Math.max(min, value - step))}
      >
        <Minus className="stepper__icon" />
      </button>
      <span className="stepper__value" aria-live="polite">
        {format ? format(value) : value}
      </span>
      <button
        type="button"
        className="stepper__button"
        aria-label={`Increase: ${label}`}
        disabled={value >= max}
        onClick={() => onChange(Math.min(max, value + step))}
      >
        <Plus className="stepper__icon" />
      </button>
    </div>
  )
}

/**
 * Раздел настроек доски: какой агент берёт задачи, сколько агентов работают сразу и как
 * проверяются pull request'ы.
 */
export function BoardSettings() {
  const { boardMaxAgents, boardAgent, boardReview, boardReviewer, boardMaxRounds, boardPollSeconds } =
    useSettings()

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
                {boardMaxAgents === null
                  ? 'No limit: every queued task gets an agent right away.'
                  : 'Queued tasks wait until one of the running agents finishes.'}
              </span>
            </span>
            <Stepper
              label="Agents at once"
              value={boardMaxAgents ?? UNLIMITED_AGENTS_STEP}
              min={BOARD_AGENTS.min}
              max={UNLIMITED_AGENTS_STEP}
              format={(value) => (value === UNLIMITED_AGENTS_STEP ? 'Unlimited' : String(value))}
              onChange={(value) =>
                void atox.settings.update({
                  boardMaxAgents: value === UNLIMITED_AGENTS_STEP ? null : value
                })
              }
            />
          </div>
        </div>
      </div>

      <div className="settings__subgroup">
        <h2 className="settings__subgroup-title">Review</h2>
        <div className="settings__card">
          <label className="settings__row">
            <span className="settings__label">
              <span>Review by a separate agent</span>
              <span className="settings__description">
                Checked by default when you start a task. A fresh agent reviews the pull request and
                comments on it; the task’s agent fixes what blocks the merge.
              </span>
            </span>
            <input
              type="checkbox"
              role="switch"
              className="switch"
              checked={boardReview}
              onChange={(event) => void atox.settings.update({ boardReview: event.target.checked })}
            />
          </label>
          <div className="settings__row settings__row--stacked">
            <span className="settings__label">
              <span>Reviewer</span>
              <span className="settings__description">
                Suggested when you turn the review on for a task.
              </span>
            </span>
            <TaskAgentPicker
              value={boardReviewer}
              onChange={(value) => void atox.settings.update({ boardReviewer: value })}
            />
          </div>
          <div className="settings__row">
            <span className="settings__label">
              <span>Rounds of fixes</span>
              <span className="settings__description">
                How many times the agent fixes review comments, failed checks and conflicts before
                the task waits for you.
              </span>
            </span>
            <Stepper
              label="Rounds of fixes"
              value={boardMaxRounds}
              min={BOARD_ROUNDS.min}
              max={BOARD_ROUNDS.max}
              onChange={(value) => void atox.settings.update({ boardMaxRounds: value })}
            />
          </div>
          <div className="settings__row">
            <span className="settings__label">
              <span>Check GitHub every</span>
              <span className="settings__description">
                How often tasks in Review and Ready are checked for new commits, checks and comments.
              </span>
            </span>
            <Stepper
              label="Check interval"
              value={boardPollSeconds}
              min={BOARD_POLL_SECONDS.min}
              max={BOARD_POLL_SECONDS.max}
              step={BOARD_POLL_SECONDS.step}
              format={(value) => `${value} s`}
              onChange={(value) => void atox.settings.update({ boardPollSeconds: value })}
            />
          </div>
        </div>
      </div>
    </div>
  )
}
