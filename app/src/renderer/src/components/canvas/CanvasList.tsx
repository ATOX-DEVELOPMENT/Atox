import { useEffect, useState, type ReactNode } from 'react'
import { Search } from 'lucide-react'
import { useCanvases } from '../../hooks/CanvasesContext'
import { useProjectsContext } from '../../hooks/ProjectsContext'
import { canvasOwner } from '../../lib/canvasOwner'
import { CanvasCard } from './CanvasCard'

/** Как часто обновлять «5m», «3h» у карточек: точнее минуты они не показывают. */
const CLOCK_TICK_MS = 60_000

type Tab = 'active' | 'archived'

interface CanvasListProps {
  onClose(): void
}

/** Все холсты: действующие и в архиве, с поиском по имени, проекту и чату. */
export function CanvasList({ onClose }: CanvasListProps) {
  const canvases = useCanvases()
  const { projects } = useProjectsContext()
  const [tab, setTab] = useState<Tab>('active')
  const [query, setQuery] = useState('')
  const now = useMinuteClock()

  useEffect(() => {
    // Esc, который уже обработало поле (поиск, переименование), страницу не закрывает.
    const closeOnEscape = (event: KeyboardEvent) => {
      if (event.key === 'Escape' && !event.defaultPrevented) {
        onClose()
      }
    }
    window.addEventListener('keydown', closeOnEscape)
    return () => window.removeEventListener('keydown', closeOnEscape)
  }, [onClose])

  const entries = (canvases ?? [])
    .map((canvas) => ({ canvas, owner: canvasOwner(projects, canvas) }))
    .sort((a, b) => b.canvas.updatedAt - a.canvas.updatedAt)
  const counts = {
    active: entries.filter(({ canvas }) => !canvas.archived).length,
    archived: entries.filter(({ canvas }) => canvas.archived).length
  }
  const needle = query.trim().toLocaleLowerCase()
  const shown = entries.filter(
    ({ canvas, owner }) =>
      canvas.archived === (tab === 'archived') &&
      [canvas.name, owner.project?.name, owner.chat?.title].some((text) =>
        text?.toLocaleLowerCase().includes(needle)
      )
  )

  return (
    <section className="canvas-list" aria-labelledby="canvas-list-title">
      <header className="canvas-list__header">
        <h1 id="canvas-list-title" className="canvas-list__title">
          Canvases
        </h1>
        <div className="segmented" role="tablist" aria-label="Canvases">
          {(['active', 'archived'] as const).map((id) => (
            <button
              key={id}
              type="button"
              role="tab"
              className="segmented__item"
              aria-selected={tab === id}
              onClick={() => setTab(id)}
            >
              {id === 'active' ? 'Active' : 'Archived'}
              <span className="segmented__count">{counts[id]}</span>
            </button>
          ))}
        </div>
        <label className="repository__search canvas-list__search">
          <Search className="repository__search-icon" aria-hidden />
          <input
            type="search"
            placeholder="Search canvases"
            aria-label="Search canvases"
            value={query}
            spellCheck={false}
            onChange={(event) => setQuery(event.target.value)}
            onKeyDown={(event) => {
              // Esc сначала очищает поиск, и только пустой поиск закрывает страницу.
              if (event.key === 'Escape' && query) {
                event.preventDefault()
                setQuery('')
              }
            }}
          />
        </label>
      </header>

      <div className="canvas-list__body">
        {canvases && shown.length === 0 && (
          <div className="canvas-list__empty">
            <p className="canvas-list__empty-title">{emptyTitle(tab, needle, counts[tab])}</p>
            <p className="canvas-list__empty-hint">{emptyHint(tab, needle, counts[tab])}</p>
          </div>
        )}
        {shown.length > 0 && (
          <ul className="canvas-list__grid">
            {shown.map(({ canvas, owner }) => (
              <CanvasCard
                key={canvas.id}
                canvas={canvas}
                projectName={owner.project?.name}
                chatTitle={owner.chat?.title}
                now={now}
              />
            ))}
          </ul>
        )}
      </div>
    </section>
  )
}

function emptyTitle(tab: Tab, query: string, count: number): string {
  if (query && count > 0) {
    return 'Nothing found'
  }
  return tab === 'active' ? 'No canvases yet' : 'No archived canvases'
}

function emptyHint(tab: Tab, query: string, count: number): ReactNode {
  if (query && count > 0) {
    return 'Try another name, project or chat'
  }
  return tab === 'active' ? (
    <>
      Create one from a chat’s context menu. Agents can also create one with{' '}
      <code className="canvas-list__code">atox canvas</code>.
    </>
  ) : (
    'Archived canvases keep their screens and history and show up here'
  )
}

function useMinuteClock(): number {
  const [now, setNow] = useState(() => Date.now())
  useEffect(() => {
    const timer = setInterval(() => setNow(Date.now()), CLOCK_TICK_MS)
    return () => clearInterval(timer)
  }, [])
  return now
}
