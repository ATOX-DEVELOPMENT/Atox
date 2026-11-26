import { useState } from 'react'
import { ChevronDown, Grid3x3, Minus, Plus, X } from 'lucide-react'
import {
  effectiveScreenGrid,
  screenGridColumns,
  type CanvasScreen
} from '../../../../shared/canvas'
import { ipcErrorMessage } from '../../lib/ipcError'
import { showMenu } from '../../lib/menu'
import { describeDevice } from './ScreenFrame'

interface ScreenToolsPanelProps {
  canvasId: string
  screen: CanvasScreen
  onClose(): void
}

/** Подпись числа столбцов: «10 columns · cell 39px». */
function columnsLabel(width: number, columns: number): string {
  return `${columns} columns · cell ${width / columns}px`
}

/**
 * Панель рабочего экрана (двойной клик по экрану): инструменты, которые помогают работать с ним
 * на холсте. Пока это сетка поверх экрана: видна ли она и на сколько столбцов делит экран.
 * Настройка хранится у экрана и переживает перезапуск, а сама страница от неё не меняется.
 */
export function ScreenToolsPanel({ canvasId, screen, onClose }: ScreenToolsPanelProps) {
  const [error, setError] = useState<string | null>(null)
  const options = screenGridColumns(screen.width)
  const grid = effectiveScreenGrid(screen)
  const visible = screen.grid?.visible ?? false
  const columns = grid.columns
  const index = columns === null ? -1 : options.indexOf(columns)

  const save = (next: { visible: boolean; columns: number }) => {
    setError(null)
    window.atox.canvas
      .setScreenGrid(canvasId, screen.id, next)
      .catch((failure: unknown) => setError(ipcErrorMessage(failure)))
  }
  // Новое число столбцов сразу показывает сетку: иначе выбор ничего бы не изменил на экране.
  const pick = (next: number | undefined) => {
    if (next !== undefined && next !== columns) {
      save({ visible: true, columns: next })
    }
  }

  const openColumns = async (anchor: HTMLElement) => {
    const action = await showMenu(
      options.map((n) => ({
        action: String(n),
        label: columnsLabel(screen.width, n),
        checked: n === columns
      })),
      anchor
    )
    if (action) {
      pick(Number(action))
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
            checked={visible && columns !== null}
            disabled={columns === null}
            onChange={(event) =>
              columns !== null && save({ visible: event.target.checked, columns })
            }
          />
        </label>
        {columns === null ? (
          <p className="screen-tools__hint">
            {screen.width} px does not divide into an even number of square columns.
          </p>
        ) : (
          <>
            <div className="screen-tools__stepper" role="group" aria-label="Grid columns">
              <button
                type="button"
                className="screen-tools__step"
                aria-label="Fewer columns"
                disabled={index <= 0}
                onClick={() => pick(options[index - 1])}
              >
                <Minus className="icon" aria-hidden />
              </button>
              <button
                type="button"
                className="screen-tools__columns"
                aria-haspopup="menu"
                onClick={(event) => void openColumns(event.currentTarget)}
              >
                <span>{columnsLabel(screen.width, columns)}</span>
                <ChevronDown className="icon" aria-hidden />
              </button>
              <button
                type="button"
                className="screen-tools__step"
                aria-label="More columns"
                disabled={index >= options.length - 1}
                onClick={() => pick(options[index + 1])}
              >
                <Plus className="icon" aria-hidden />
              </button>
            </div>
            <p className="screen-tools__hint">
              {columns} × {Math.ceil(screen.height / (screen.width / columns))} cells. Only on the
              canvas: the page, export and share link stay unchanged.
            </p>
          </>
        )}
        {error && (
          <p className="screen-tools__error" role="alert">
            {error}
          </p>
        )}
      </section>
    </aside>
  )
}
