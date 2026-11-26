import { useEffect, useState } from 'react'
import {
  CANVAS_GRID,
  CANVAS_GRID_PRESETS,
  CANVAS_GRID_SIZE,
  isCanvasGridSize,
  type CanvasGrid
} from '../../../../shared/canvas'
import { ipcErrorMessage } from '../../lib/ipcError'

interface ToolsDrawerProps {
  canvasId: string
  grid: CanvasGrid
}

/**
 * Вкладка Tools: настройки инструментов холста. Пока это сетка: видна ли она, её шаг
 * и прилипают ли к ней экраны. Сетка одна на холст чата: настройка действует на все его
 * страницы и хранится вместе с холстом, поэтому переживает перезапуск.
 */
export function ToolsDrawer({ canvasId, grid }: ToolsDrawerProps) {
  // Поле размера: пока человек печатает, в нём может быть неполное число — сетка меняется,
  // только когда число допустимо.
  const [sizeText, setSizeText] = useState(String(grid.size))
  const [error, setError] = useState<string | null>(null)
  useEffect(() => setSizeText(String(grid.size)), [grid.size])

  const update = (patch: Partial<CanvasGrid>) => {
    setError(null)
    window.atox.canvas
      .setGrid(canvasId, { ...grid, ...patch })
      .catch((failure: unknown) => setError(ipcErrorMessage(failure)))
  }

  const changeSize = (text: string) => {
    setSizeText(text)
    const size = Number(text)
    if (isCanvasGridSize(size) && size !== grid.size) {
      update({ size })
    }
  }

  return (
    <aside className="history-drawer tools-drawer" aria-label="Tools">
      <header className="history-drawer__header">
        <h2 className="history-drawer__title">Tools</h2>
        <span className="history-drawer__canvas">All pages</span>
      </header>
      <div className="history-drawer__body">
        <section className="tools-drawer__section" aria-labelledby="tools-grid-title">
          <h3 id="tools-grid-title" className="tools-drawer__section-title">
            Grid
          </h3>
          <label className="tools-drawer__row">
            <span className="tools-drawer__label">Show grid</span>
            <input
              type="checkbox"
              role="switch"
              className="switch"
              checked={grid.visible}
              onChange={(event) => update({ visible: event.target.checked })}
            />
          </label>
          <label className="tools-drawer__row">
            <span className="tools-drawer__label">
              <span>Snap to grid</span>
              <span className="tools-drawer__description">
                Screens and groups land on grid lines. Works with a hidden grid too.
              </span>
            </span>
            <input
              type="checkbox"
              role="switch"
              className="switch"
              checked={grid.snap}
              onChange={(event) => update({ snap: event.target.checked })}
            />
          </label>
          <div className="tools-drawer__row tools-drawer__row--stacked">
            <label className="tools-drawer__label" htmlFor="tools-grid-size">
              <span>Grid size</span>
              <span className="tools-drawer__description">
                {CANVAS_GRID_SIZE.min}–{CANVAS_GRID_SIZE.max} px, default {CANVAS_GRID}
              </span>
            </label>
            <div className="tools-drawer__size">
              <div className="segmented segmented--small" role="radiogroup" aria-label="Preset">
                {CANVAS_GRID_PRESETS.map((preset) => (
                  <button
                    key={preset}
                    type="button"
                    role="radio"
                    className="segmented__item"
                    aria-checked={grid.size === preset}
                    onClick={() => update({ size: preset })}
                  >
                    {preset}
                  </button>
                ))}
              </div>
              <input
                id="tools-grid-size"
                type="number"
                className="tools-drawer__number"
                min={CANVAS_GRID_SIZE.min}
                max={CANVAS_GRID_SIZE.max}
                step={1}
                value={sizeText}
                aria-invalid={!isCanvasGridSize(Number(sizeText))}
                onChange={(event) => changeSize(event.target.value)}
                // Недопустимое число не остаётся в поле: оно возвращается к шагу сетки.
                onBlur={() => setSizeText(String(grid.size))}
              />
            </div>
          </div>
          {error && (
            <p className="history-drawer__message" role="alert">
              {error}
            </p>
          )}
        </section>
      </div>
    </aside>
  )
}
