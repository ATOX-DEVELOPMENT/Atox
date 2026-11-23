import { useEffect, useMemo, useRef, useState, type ReactNode } from 'react'
import { createPortal } from 'react-dom'
import { File as FileIcon, Search } from 'lucide-react'
import type { FileChangeKind } from '../../../shared/changes'
import { fuzzyMatch } from '../lib/fuzzyMatch'

/** Сколько найденных файлов показывать: дальше уточняют запрос. */
const RESULTS_LIMIT = 50

interface QuickOpenProps {
  files: readonly string[]
  /** Изменённые файлы: без запроса они идут первыми — к ним чаще всего и переходят. */
  changed: ReadonlyMap<string, FileChangeKind>
  onOpen(path: string): void
  onClose(): void
}

/** Поиск файла по имени, как ⌘P в редакторах: буквы запроса по порядку, не подряд. */
export function QuickOpen({ files, changed, onOpen, onClose }: QuickOpenProps) {
  const [query, setQuery] = useState('')
  const [selected, setSelected] = useState(0)
  const listRef = useRef<HTMLUListElement>(null)

  const results = useMemo(() => {
    const trimmed = query.trim()
    if (!trimmed) {
      const changedFirst = [...changed.keys()].filter((path) => files.includes(path))
      const rest = files.filter((path) => !changed.has(path))
      return [...changedFirst, ...rest]
        .slice(0, RESULTS_LIMIT)
        .map((path) => ({ path, positions: [] as number[] }))
    }
    return files
      .flatMap((path) => {
        const match = fuzzyMatch(trimmed, path)
        return match ? [{ path, ...match }] : []
      })
      .sort((a, b) => b.score - a.score || a.path.length - b.path.length)
      .slice(0, RESULTS_LIMIT)
  }, [query, files, changed])

  useEffect(() => setSelected(0), [query])
  useEffect(() => {
    listRef.current?.children[selected]?.scrollIntoView({ block: 'nearest' })
  }, [selected])

  const choose = (index: number) => {
    const result = results[index]
    if (result) {
      onOpen(result.path)
    }
  }

  return createPortal(
    <div className="quick-open" onMouseDown={onClose}>
      <div
        className="quick-open__dialog"
        role="dialog"
        aria-label="Go to file"
        onMouseDown={(event) => event.stopPropagation()}
      >
        <label className="quick-open__search">
          <Search className="icon" aria-hidden />
          <input
            className="quick-open__input"
            value={query}
            placeholder="Search files by name"
            autoFocus
            spellCheck={false}
            aria-controls="quick-open-results"
            onChange={(event) => setQuery(event.target.value)}
            onKeyDown={(event) => {
              if (event.key === 'ArrowDown') {
                event.preventDefault()
                setSelected((index) => Math.min(results.length - 1, index + 1))
              } else if (event.key === 'ArrowUp') {
                event.preventDefault()
                setSelected((index) => Math.max(0, index - 1))
              } else if (event.key === 'Enter') {
                event.preventDefault()
                choose(selected)
              } else if (event.key === 'Escape') {
                event.preventDefault()
                onClose()
              }
            }}
          />
        </label>
        {results.length === 0 ? (
          <p className="quick-open__empty">No matching files</p>
        ) : (
          <ul id="quick-open-results" ref={listRef} className="quick-open__results" role="listbox">
            {results.map(({ path, positions }, index) => {
              const slash = path.lastIndexOf('/')
              return (
                <li
                  key={path}
                  role="option"
                  aria-selected={index === selected}
                  className="quick-open__result"
                  onMouseMove={() => setSelected(index)}
                  onClick={() => choose(index)}
                >
                  <FileIcon className="icon" aria-hidden />
                  <span className="quick-open__name">
                    <Highlighted text={path} positions={positions} from={slash + 1} to={path.length} />
                  </span>
                  {slash > 0 && (
                    <span className="quick-open__directory">
                      <Highlighted text={path} positions={positions} from={0} to={slash} />
                    </span>
                  )}
                  {changed.has(path) && <span className="quick-open__changed" title="Changed" />}
                </li>
              )
            })}
          </ul>
        )}
      </div>
    </div>,
    document.body
  )
}

interface HighlightedProps {
  text: string
  positions: readonly number[]
  from: number
  to: number
}

/** Кусок пути с выделенными буквами, которые совпали с запросом. */
function Highlighted({ text, positions, from, to }: HighlightedProps) {
  const parts: ReactNode[] = []
  let start = from
  for (const position of positions) {
    if (position < from || position >= to) {
      continue
    }
    if (position > start) {
      parts.push(text.slice(start, position))
    }
    parts.push(<mark key={position}>{text[position]}</mark>)
    start = position + 1
  }
  parts.push(text.slice(start, to))
  return <>{parts}</>
}
