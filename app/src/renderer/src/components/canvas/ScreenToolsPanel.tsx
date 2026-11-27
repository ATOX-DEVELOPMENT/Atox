import { useState } from 'react'
import { ChevronDown, Grid3x3, Minus, Plus, Ruler, X } from 'lucide-react'
import {
  SCREEN_DEVICES,
  SCREEN_GRID_GOOD_CELL,
  SCREEN_SIZE,
  describeScreenGridOption,
  devicesOf,
  effectiveScreenGrid,
  needsBetterScreenSize,
  screenGridOptions,
  suggestScreenSizes,
  type CanvasScreen,
  type DeviceCategory,
  type ScreenResize
} from '../../../../shared/canvas'
import { ipcErrorMessage } from '../../lib/ipcError'
import { showMenu, type MenuItem } from '../../lib/menu'
import { describeDevice } from './ScreenFrame'

interface ScreenToolsPanelProps {
  canvasId: string
  screen: CanvasScreen
  onClose(): void
}

const PRESET_SECTIONS: { category: DeviceCategory; label: string }[] = [
  { category: 'phone', label: 'Phone' },
  { category: 'tablet', label: 'Tablet' },
  { category: 'desktop', label: 'Desktop' },
  { category: 'document', label: 'Slide & page' }
]

/**
 * Панель рабочего экрана (двойной клик по экрану): инструменты, которые помогают работать с ним
 * на холсте. Размер — меняет сам экран на холсте (его ширину и высоту), а не HTML. Сетка — целые
 * одинаковые квадраты поверх экрана: клетка делит ширину и высоту нацело, столбцов чётное число.
 * Настройки хранятся у экрана и переживают перезапуск, а сама страница от сетки не меняется.
 */
export function ScreenToolsPanel({ canvasId, screen, onClose }: ScreenToolsPanelProps) {
  const [error, setError] = useState<string | null>(null)
  const options = screenGridOptions(screen.width, screen.height)
  const grid = effectiveScreenGrid(screen)
  const current = grid.option
  const index = current === null ? -1 : options.findIndex(({ cell }) => cell === current.cell)
  const suggestions = needsBetterScreenSize(screen.width, screen.height)
    ? suggestScreenSizes(screen.width, screen.height)
    : []

  const run = (action: Promise<void>) => {
    setError(null)
    action.catch((failure: unknown) => setError(ipcErrorMessage(failure)))
  }
  const saveGrid = (next: { visible: boolean; cell: number }) =>
    run(window.atox.canvas.setScreenGrid(canvasId, screen.id, next))
  const resize = (look: ScreenResize) => run(window.atox.canvas.resizeScreen(canvasId, screen.id, look))

  // Новая клетка сразу показывает сетку: иначе выбор ничего бы не изменил на экране.
  const pick = (cell: number | undefined) => {
    if (cell !== undefined && cell !== current?.cell) {
      saveGrid({ visible: true, cell })
    }
  }

  const openOptions = async (anchor: HTMLElement) => {
    const action = await showMenu(
      options.map((option) => ({
        action: String(option.cell),
        label: describeScreenGridOption(option),
        checked: option.cell === current?.cell
      })),
      anchor
    )
    if (action) {
      pick(Number(action))
    }
  }

  const openPresets = async (anchor: HTMLElement) => {
    const items: MenuItem<string>[] = PRESET_SECTIONS.map(({ category, label }) => ({
      type: 'submenu',
      label,
      items: devicesOf(category).map((id) => {
        const device = SCREEN_DEVICES[id]
        const fits = !needsBetterScreenSize(device.width, device.height)
        return {
          action: id,
          label: `${device.name} · ${device.width} × ${device.height}${fits ? '' : ' · no good grid'}`,
          checked: screen.device === id
        }
      })
    }))
    const action = await showMenu(items, anchor)
    if (action && action in SCREEN_DEVICES) {
      resize({ device: action as keyof typeof SCREEN_DEVICES })
    }
  }

  return (
    <aside className="screen-tools" aria-label={`Tools for ${screen.name}`}>
      <header className="screen-tools__header">
        <div className="screen-tools__heading">
          <h2 className="screen-tools__title">{screen.name}</h2>
          <span className="screen-tools__subtitle">{describeDevice(screen)}</span>
        </div>
        <button
          type="button"
          className="icon-button screen-tools__close"
          aria-label="Close screen tools"
          title="Close (Esc)"
          onClick={onClose}
        >
          <X className="icon" aria-hidden />
        </button>
      </header>

      <section className="screen-tools__section" aria-labelledby="screen-tools-size">
        <div className="screen-tools__row">
          <Ruler className="icon screen-tools__icon" aria-hidden />
          <span id="screen-tools-size" className="screen-tools__label">
            Size
          </span>
          <button
            type="button"
            className="screen-tools__presets"
            aria-haspopup="menu"
            onClick={(event) => void openPresets(event.currentTarget)}
          >
            <span>Presets</span>
            <ChevronDown className="icon" aria-hidden />
          </button>
        </div>
        <SizeForm
          // Размер поменялся снаружи (пресет, агент): поля начинаются с нового.
          key={`${screen.width}x${screen.height}`}
          width={screen.width}
          height={screen.height}
          onSubmit={(width, height) => resize({ device: 'custom', width, height })}
        />
        {suggestions.length > 0 && (
          <div className="screen-tools__suggest">
            <p className="screen-tools__hint">
              {options.length === 0
                ? `${screen.width} × ${screen.height} can't be split into whole equal squares${screen.width % 2 === 0 ? '' : ' (the width is odd)'}. Nearest sizes that can:`
                : `Only cells under ${SCREEN_GRID_GOOD_CELL}px fit ${screen.width} × ${screen.height}. Nearest sizes with a coarser grid:`}
            </p>
            <div className="screen-tools__chips">
              {suggestions.map((suggestion) => (
                <button
                  key={`${suggestion.width}x${suggestion.height}`}
                  type="button"
                  className="screen-tools__chip"
                  title={`Resize to ${suggestion.width} × ${suggestion.height}: ${describeScreenGridOption(suggestion.grid)}`}
                  onClick={() =>
                    resize({ device: 'custom', width: suggestion.width, height: suggestion.height })
                  }
                >
                  <span className="screen-tools__chip-size">
                    {suggestion.width} × {suggestion.height}
                  </span>
                  <span className="screen-tools__chip-grid">{suggestion.grid.cell}px</span>
                </button>
              ))}
            </div>
          </div>
        )}
      </section>

      <section className="screen-tools__section" aria-labelledby="screen-tools-grid">
        <label className="screen-tools__row">
          <Grid3x3 className="icon screen-tools__icon" aria-hidden />
          <span id="screen-tools-grid" className="screen-tools__label">
            Grid
          </span>
          <input
            type="checkbox"
            role="switch"
            className="switch"
            checked={grid.visible}
            disabled={current === null}
            onChange={(event) =>
              current !== null && saveGrid({ visible: event.target.checked, cell: current.cell })
            }
          />
        </label>
        {current === null ? (
          <p className="screen-tools__hint">
            No grid for this size: pick a size above whose width and height share a square cell.
          </p>
        ) : (
          <>
            <div className="screen-tools__stepper" role="group" aria-label="Grid cell">
              <button
                type="button"
                className="screen-tools__step"
                aria-label="Bigger cells"
                title="Bigger cells"
                disabled={index <= 0}
                onClick={() => pick(options[index - 1]?.cell)}
              >
                <Minus className="icon" aria-hidden />
              </button>
              <button
                type="button"
                className="screen-tools__columns"
                aria-haspopup="menu"
                onClick={(event) => void openOptions(event.currentTarget)}
              >
                <span>{describeScreenGridOption(current)}</span>
                <ChevronDown className="icon" aria-hidden />
              </button>
              <button
                type="button"
                className="screen-tools__step"
                aria-label="Smaller cells"
                title="Smaller cells"
                disabled={index >= options.length - 1}
                onClick={() => pick(options[index + 1]?.cell)}
              >
                <Plus className="icon" aria-hidden />
              </button>
            </div>
            <p className="screen-tools__hint">
              {current.columns} columns × {current.rows} rows of whole {current.cell}px squares.
              Only on the canvas: the page, export and share link stay unchanged.
            </p>
          </>
        )}
      </section>
      {error && (
        <p className="screen-tools__error" role="alert">
          {error}
        </p>
      )}
    </aside>
  )
}

/** Поля ширины и высоты: Enter или «Apply» меняет размер экрана. */
function SizeForm({
  width,
  height,
  onSubmit
}: {
  width: number
  height: number
  onSubmit(width: number, height: number): void
}) {
  const [draftWidth, setDraftWidth] = useState(String(width))
  const [draftHeight, setDraftHeight] = useState(String(height))
  const nextWidth = parseDimension(draftWidth)
  const nextHeight = parseDimension(draftHeight)
  const changed = nextWidth !== width || nextHeight !== height
  const ready = nextWidth !== null && nextHeight !== null && changed
  const preview =
    nextWidth !== null && nextHeight !== null && changed
      ? screenGridOptions(nextWidth, nextHeight).length > 0
      : null

  return (
    <form
      className="screen-tools__size"
      onSubmit={(event) => {
        event.preventDefault()
        if (ready) {
          onSubmit(nextWidth, nextHeight)
        }
      }}
    >
      <input
        className="screen-tools__number"
        type="number"
        inputMode="numeric"
        aria-label="Width"
        min={SCREEN_SIZE.min}
        max={SCREEN_SIZE.max}
        step={1}
        value={draftWidth}
        aria-invalid={nextWidth === null}
        onChange={(event) => setDraftWidth(event.target.value)}
      />
      <span className="screen-tools__times" aria-hidden>
        ×
      </span>
      <input
        className="screen-tools__number"
        type="number"
        inputMode="numeric"
        aria-label="Height"
        min={SCREEN_SIZE.min}
        max={SCREEN_SIZE.max}
        step={1}
        value={draftHeight}
        aria-invalid={nextHeight === null}
        onChange={(event) => setDraftHeight(event.target.value)}
      />
      <button
        type="submit"
        className="screen-tools__apply"
        disabled={!ready}
        title={preview === false ? 'This size has no exact square grid' : undefined}
      >
        Apply
      </button>
    </form>
  )
}

/** Сторона экрана: целое число в допустимых границах; иначе `null`. */
function parseDimension(value: string): number | null {
  const number = Number(value.trim())
  return value.trim() !== '' &&
    Number.isInteger(number) &&
    number >= SCREEN_SIZE.min &&
    number <= SCREEN_SIZE.max
    ? number
    : null
}
