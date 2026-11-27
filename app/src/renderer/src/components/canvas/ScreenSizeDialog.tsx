import { useEffect, useRef, useState, type MouseEvent } from 'react'
import { ChevronDown, Folder, X } from 'lucide-react'
import {
  CANVAS_NAME_MAX_LENGTH,
  SCREEN_DEVICES,
  SCREEN_SIZE,
  devicesOf,
  type DeviceCategory,
  type ScreenDeviceId,
  type ScreenFrame,
  type ScreenLook
} from '../../../../shared/canvas'
import { useProjectsContext } from '../../hooks/ProjectsContext'
import { ipcErrorMessage } from '../../lib/ipcError'
import { showMenu } from '../../lib/menu'

type SizeTab = DeviceCategory | 'custom'

const TABS: { id: SizeTab; label: string }[] = [
  { id: 'desktop', label: 'Desktop' },
  { id: 'phone', label: 'Phone' },
  { id: 'tablet', label: 'Tablet' },
  { id: 'document', label: 'Slide & page' },
  { id: 'custom', label: 'Custom' }
]

const FRAMES: { id: ScreenFrame; label: string }[] = [
  { id: 'none', label: 'None' },
  { id: 'browser', label: 'Browser' },
  { id: 'window', label: 'Window' },
  { id: 'phone', label: 'Phone' },
  { id: 'tablet', label: 'Tablet' }
]

const FRAME_LABELS: Record<ScreenFrame, string> = {
  none: 'no frame',
  browser: 'browser frame',
  window: 'window frame',
  phone: 'phone frame',
  tablet: 'tablet frame'
}

/** Устройство, выбранное в каждом разделе сразу, пока человек не выбрал другое. */
const DEFAULT_DEVICE: Record<DeviceCategory, ScreenDeviceId> = {
  desktop: 'web-1440',
  phone: 'iphone-16',
  tablet: 'tablet',
  document: 'slide'
}

export interface NewCanvasRequest {
  name: string
  projectId: string
  look: ScreenLook
}

interface ScreenSizeDialogProps {
  /**
   * `canvas` — новый холст без чата: имя, проект и размер первого экрана. `screen` — пустой экран
   * на открытой странице: только размер.
   */
  mode: 'canvas' | 'screen'
  /** Делает дело; ошибка показывается в окне, и окно остаётся открытым. */
  onSubmit(request: NewCanvasRequest): Promise<void>
  onClose(): void
}

/** Окно выбора размера экрана: готовые устройства по разделам или свой размер с рамкой. */
export function ScreenSizeDialog({ mode, onSubmit, onClose }: ScreenSizeDialogProps) {
  const { projects, currentProjectId } = useProjectsContext()
  const [name, setName] = useState('Untitled canvas')
  const [projectId, setProjectId] = useState(currentProjectId ?? projects[0]?.id ?? '')
  const [tab, setTab] = useState<SizeTab>('desktop')
  const [chosen, setChosen] = useState<Record<DeviceCategory, ScreenDeviceId>>(DEFAULT_DEVICE)
  const [width, setWidth] = useState('1440')
  const [height, setHeight] = useState('900')
  const [frame, setFrame] = useState<ScreenFrame>('none')
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const nameRef = useRef<HTMLInputElement>(null)

  useEffect(() => {
    nameRef.current?.select()
  }, [])

  useEffect(() => {
    const handleKey = (event: KeyboardEvent) => {
      if (event.key === 'Escape' && !event.defaultPrevented) {
        // Esc закрывает окно, а не страницу под ним.
        event.preventDefault()
        onClose()
      }
    }
    window.addEventListener('keydown', handleKey)
    return () => window.removeEventListener('keydown', handleKey)
  }, [onClose])

  const customWidth = parseDimension(width)
  const customHeight = parseDimension(height)
  const look: ScreenLook | null =
    tab === 'custom'
      ? customWidth !== null && customHeight !== null
        ? { device: 'custom', width: customWidth, height: customHeight, frame }
        : null
      : { device: chosen[tab] }
  const project = projects.find(({ id }) => id === projectId)
  const trimmedName = name.trim()
  const ready =
    look !== null && !busy && (mode === 'screen' || (project !== undefined && trimmedName !== ''))

  const summary = look ? describeLook(look) : `Each side from ${SCREEN_SIZE.min} to ${SCREEN_SIZE.max} px`

  const submit = async () => {
    if (!ready || !look) {
      return
    }
    setBusy(true)
    setError(null)
    try {
      await onSubmit({ name: trimmedName, projectId, look })
    } catch (failure) {
      setError(ipcErrorMessage(failure))
      setBusy(false)
    }
  }

  const chooseProject = async (event: MouseEvent<HTMLButtonElement>) => {
    const choice = await showMenu<string>(
      projects.map(({ id, name: projectName }) => ({
        action: id,
        label: projectName,
        icon: <Folder />,
        checked: id === projectId
      })),
      event.currentTarget
    )
    if (choice !== null) {
      setProjectId(choice)
    }
  }

  const titleId = `screen-size-title-${mode}`

  return (
    <div className="modal" role="presentation" onMouseDown={onClose}>
      <div
        className="modal__dialog screen-size"
        role="dialog"
        aria-modal="true"
        aria-labelledby={titleId}
        onMouseDown={(event) => event.stopPropagation()}
      >
        <header className="modal__header">
          <div>
            <h2 id={titleId} className="modal__title">
              {mode === 'canvas' ? 'New canvas' : 'Add a blank screen'}
            </h2>
            <p className="modal__subtitle">
              {mode === 'canvas'
                ? 'A canvas of your own, without a chat. Link a chat or start an agent later.'
                : 'An empty screen of the size you choose. Ask an agent to design it later.'}
            </p>
          </div>
          <button type="button" className="icon-button" aria-label="Close" onClick={onClose}>
            <X className="icon" />
          </button>
        </header>

        <form
          className="start-task__body"
          onSubmit={(event) => {
            event.preventDefault()
            void submit()
          }}
        >
          {mode === 'canvas' && (
            <div className="screen-size__row">
              <section className="start-task__section screen-size__grow">
                <label className="start-task__label" htmlFor="new-canvas-name">
                  Name
                </label>
                <input
                  id="new-canvas-name"
                  ref={nameRef}
                  className="screen-size__input"
                  value={name}
                  maxLength={CANVAS_NAME_MAX_LENGTH}
                  spellCheck={false}
                  onChange={(event) => setName(event.target.value)}
                />
              </section>
              <section className="start-task__section">
                <span className="start-task__label">Project</span>
                <button
                  type="button"
                  className="task-agent__button"
                  disabled={projects.length === 0}
                  title="Screen files are saved in this project, in .atox/canvas"
                  onClick={(event) => void chooseProject(event)}
                >
                  <Folder className="task-agent__icon" />
                  <span className="task-agent__value">{project?.name ?? 'No projects'}</span>
                  <ChevronDown className="task-agent__chevron" />
                </button>
              </section>
            </div>
          )}

          <section className="start-task__section">
            <span className="start-task__label">Screen size</span>
            <div className="segmented screen-size__tabs" role="tablist" aria-label="Screen size">
              {TABS.map(({ id, label }) => (
                <button
                  key={id}
                  type="button"
                  role="tab"
                  className="segmented__item"
                  aria-selected={tab === id}
                  onClick={() => setTab(id)}
                >
                  {label}
                </button>
              ))}
            </div>
            {tab === 'custom' ? (
              <div className="screen-size__custom">
                <div className="screen-size__dimensions">
                  <DimensionInput label="Width" value={width} onChange={setWidth} />
                  <span className="screen-size__times" aria-hidden>
                    ×
                  </span>
                  <DimensionInput label="Height" value={height} onChange={setHeight} />
                  <span className="screen-size__unit">px</span>
                </div>
                <div className="screen-size__frames">
                  <span className="screen-size__frames-label">Frame</span>
                  <div className="segmented" role="radiogroup" aria-label="Frame">
                    {FRAMES.map(({ id, label }) => (
                      <button
                        key={id}
                        type="button"
                        role="radio"
                        className="segmented__item"
                        aria-checked={frame === id}
                        onClick={() => setFrame(id)}
                      >
                        {label}
                      </button>
                    ))}
                  </div>
                </div>
              </div>
            ) : (
              <div className="screen-size__presets" role="radiogroup" aria-label="Device">
                {devicesOf(tab).map((id) => {
                  const device = SCREEN_DEVICES[id]
                  return (
                    <button
                      key={id}
                      type="button"
                      role="radio"
                      className="screen-size__preset"
                      aria-checked={chosen[tab] === id}
                      onClick={() => setChosen((current) => ({ ...current, [tab]: id }))}
                      onDoubleClick={() => void submit()}
                    >
                      <span className="screen-size__preset-name">{device.name}</span>
                      <span className="screen-size__preset-size">
                        {device.width} × {device.height}
                      </span>
                    </button>
                  )
                })}
              </div>
            )}
          </section>
          {error && (
            <p className="screen-size__error" role="alert">
              {error}
            </p>
          )}
          {/* Enter в поле отправляет форму. */}
          <button type="submit" hidden />
        </form>

        <footer className="modal__footer">
          <span className="modal__note">{summary}</span>
          <button type="button" className="settings__button" onClick={onClose}>
            Cancel
          </button>
          <button
            type="button"
            className="settings__button settings__button--primary"
            disabled={!ready}
            onClick={() => void submit()}
          >
            {mode === 'canvas' ? 'Create canvas' : 'Add screen'}
          </button>
        </footer>
      </div>
    </div>
  )
}

function DimensionInput({
  label,
  value,
  onChange
}: {
  label: string
  value: string
  onChange(value: string): void
}) {
  const invalid = parseDimension(value) === null
  return (
    <label className="screen-size__dimension">
      <span className="screen-size__dimension-label">{label}</span>
      <input
        className="screen-size__input screen-size__number"
        type="number"
        inputMode="numeric"
        min={SCREEN_SIZE.min}
        max={SCREEN_SIZE.max}
        step={1}
        value={value}
        aria-invalid={invalid}
        onChange={(event) => onChange(event.target.value)}
      />
    </label>
  )
}

/** Сторона своего размера: целое число в допустимых границах; иначе `null`. */
function parseDimension(value: string): number | null {
  const number = Number(value.trim())
  return value.trim() !== '' &&
    Number.isInteger(number) &&
    number >= SCREEN_SIZE.min &&
    number <= SCREEN_SIZE.max
    ? number
    : null
}

/** «MacBook Air 1440 × 900 · browser frame». */
function describeLook(look: ScreenLook): string {
  if (look.device === 'custom') {
    return `Custom ${look.width} × ${look.height} · ${FRAME_LABELS[look.frame]}`
  }
  const device = SCREEN_DEVICES[look.device]
  return `${device.name} ${device.width} × ${device.height} · ${FRAME_LABELS[device.frame]}`
}
