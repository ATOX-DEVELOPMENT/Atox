import { useEffect, useMemo, useRef, useState, type CSSProperties } from 'react'
import {
  ArrowLeft,
  ChevronRight,
  ExternalLink,
  File as FileIcon,
  Folder,
  FolderOpen,
  RefreshCw,
  Search
} from 'lucide-react'
import type { FileChangeKind } from '../../../shared/changes'
import type { ProjectFileContent, ProjectFileList } from '../../../shared/projectFiles'
import { TERMINAL_WIDTH } from '../../../shared/settings'
import { formatShortcut } from '../../../shared/shortcuts'
import { useProjectChanges } from '../hooks/useProjectChanges'
import { useProjectsContext } from '../hooks/ProjectsContext'
import { useSettings } from '../hooks/SettingsContext'
import { ipcErrorMessage } from '../lib/ipcError'
import { CodeView } from './CodeView'
import { PanelResizer } from './PanelResizer'
import { QuickOpen } from './QuickOpen'

const { atox } = window

/** Буква изменения у файла в дереве — как в панели изменений и в редакторах. */
const KIND_LETTERS: Record<FileChangeKind, string> = {
  modified: 'M',
  added: 'A',
  deleted: 'D',
  renamed: 'R',
  untracked: 'U'
}

const KIND_LABELS: Record<FileChangeKind, string> = {
  modified: 'Modified',
  added: 'Added',
  deleted: 'Deleted',
  renamed: 'Renamed',
  untracked: 'New file'
}

/** Содержимое одной папки дерева: вложенные папки и файлы, по имени. */
interface DirectoryEntries {
  directories: string[]
  files: string[]
}

type ListState =
  | { kind: 'loading' }
  | { kind: 'loaded'; list: ProjectFileList }
  | { kind: 'failed'; message: string }

type FileState =
  | { kind: 'loading' }
  | { kind: 'loaded'; content: ProjectFileContent }
  | { kind: 'failed'; message: string }

interface FilesPanelProps {
  projectId: string
  /** Растёт с каждым ⌘P: открывает поиск файла. */
  quickOpenRequest: number
}

/**
 * Панель справа от чатов: файлы проекта деревом и просмотр файла с подсветкой — только
 * чтение. Файлы, которые поменяли агенты, помечены буквой, папки с ними — точкой.
 */
export function FilesPanel({ projectId, quickOpenRequest }: FilesPanelProps) {
  const { terminalWidth, shortcuts } = useSettings()
  const { projects } = useProjectsContext()
  const projectPath = projects.find(({ id }) => id === projectId)?.path
  const [draftWidth, setDraftWidth] = useState<number | null>(null)
  const width = draftWidth ?? terminalWidth
  const { result: changes, refresh: refreshChanges } = useProjectChanges(projectId)
  const [listState, setListState] = useState<ListState>({ kind: 'loading' })
  const [expanded, setExpanded] = useState<ReadonlySet<string>>(new Set())
  const [openPath, setOpenPath] = useState<string | null>(null)
  const [quickOpen, setQuickOpen] = useState(false)
  const handledRequest = useRef(quickOpenRequest)
  const files = listState.kind === 'loaded' ? listState.list.files : null
  const prefix = listState.kind === 'loaded' ? listState.list.repositoryPrefix : ''

  // ⌘P, пока панель открыта, и ⌘P, который её открыл, — открывают поиск.
  useEffect(() => {
    if (quickOpenRequest !== 0 && quickOpenRequest !== handledRequest.current) {
      handledRequest.current = quickOpenRequest
      setQuickOpen(true)
    }
  }, [quickOpenRequest])
  useEffect(() => {
    if (quickOpenRequest !== 0) {
      setQuickOpen(true)
    }
    // Только при открытии панели: дальше запросы ловит эффект выше.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  // Список перечитывается вместе с изменениями: агент мог создать или удалить файл.
  useEffect(() => {
    let disposed = false
    atox.projectFiles
      .list(projectId)
      .then((list) => !disposed && setListState({ kind: 'loaded', list }))
      .catch(
        (error: unknown) =>
          !disposed && setListState({ kind: 'failed', message: ipcErrorMessage(error) })
      )
    return () => {
      disposed = true
    }
  }, [projectId, changes])

  const tree = useMemo(() => buildTree(files ?? []), [files])

  // Изменения git считает от корня репозитория — переводятся в пути от папки проекта.
  const changed = useMemo(() => {
    const kinds = new Map<string, FileChangeKind>()
    const dirtyDirectories = new Set<string>()
    if (changes?.ok) {
      for (const change of changes.files) {
        if (!change.path.startsWith(prefix)) {
          continue
        }
        const path = change.path.slice(prefix.length)
        kinds.set(path, change.kind)
        for (let slash = path.lastIndexOf('/'); slash > 0; slash = path.lastIndexOf('/', slash - 1)) {
          dirtyDirectories.add(path.slice(0, slash))
        }
      }
    }
    return { kinds, dirtyDirectories }
  }, [changes, prefix])

  const toggle = (directory: string) =>
    setExpanded((current) => {
      const next = new Set(current)
      if (!next.delete(directory)) {
        next.add(directory)
      }
      return next
    })

  /** Открывает файл и раскрывает папки до него — чтобы, вернувшись, видеть, где он. */
  const openFile = (path: string) => {
    setOpenPath(path)
    setExpanded((current) => {
      const next = new Set(current)
      for (let slash = path.indexOf('/'); slash > 0; slash = path.indexOf('/', slash + 1)) {
        next.add(path.slice(0, slash))
      }
      return next
    })
  }

  const refresh = () => refreshChanges()

  return (
    <aside
      className="changes-panel files-panel"
      style={{ '--terminal-width': `${width}px` } as CSSProperties}
    >
      <header className="changes-panel__header">
        {openPath ? (
          <>
            <button
              type="button"
              className="icon-button files-panel__back"
              aria-label="Back to files"
              title="Back to files"
              onClick={() => setOpenPath(null)}
            >
              <ArrowLeft className="icon" />
            </button>
            <span className="files-panel__path" title={openPath}>
              <span className="files-panel__file-name">{baseName(openPath)}</span>
              {openPath.includes('/') && (
                <span className="files-panel__directory">{directoryOf(openPath)}</span>
              )}
            </span>
          </>
        ) : (
          <h2 className="changes-panel__title">Files</h2>
        )}
        <span className="files-panel__actions">
          {openPath && projectPath && (
            <button
              type="button"
              className="icon-button"
              aria-label="Open in default app"
              title="Open in default app"
              onClick={() => void atox.files.open(openPath, projectPath)}
            >
              <ExternalLink className="icon" />
            </button>
          )}
          <button
            type="button"
            className="icon-button"
            aria-label="Go to file"
            title={`Go to file (${formatShortcut('quickOpen', shortcuts)})`}
            onClick={() => setQuickOpen(true)}
          >
            <Search className="icon" />
          </button>
          <button
            type="button"
            className="icon-button"
            aria-label="Refresh"
            title="Refresh"
            onClick={refresh}
          >
            <RefreshCw className="icon" />
          </button>
        </span>
      </header>

      <div className="changes-panel__body files-panel__body">
        {openPath ? (
          <FileViewer key={openPath} projectId={projectId} path={openPath} />
        ) : listState.kind === 'loading' ? (
          <p className="changes-panel__message">Loading files…</p>
        ) : listState.kind === 'failed' ? (
          <p className="changes-panel__message" role="alert">
            Couldn’t list the files. {listState.message}
          </p>
        ) : listState.list.files.length === 0 ? (
          <p className="changes-panel__message">No files</p>
        ) : (
          <>
            <ul className="file-tree" role="tree" aria-label="Files">
              <TreeLevel
                directory=""
                depth={0}
                tree={tree}
                expanded={expanded}
                changed={changed}
                onToggle={toggle}
                onOpen={openFile}
              />
            </ul>
            {listState.list.truncated && (
              <p className="changes-panel__message">
                The project is too large to show every file. Use search to find one.
              </p>
            )}
          </>
        )}
      </div>

      {quickOpen && files && (
        <QuickOpen
          files={files}
          changed={changed.kinds}
          onOpen={(path) => {
            setQuickOpen(false)
            openFile(path)
          }}
          onClose={() => setQuickOpen(false)}
        />
      )}

      <PanelResizer
        width={width}
        bounds={TERMINAL_WIDTH}
        edge="left"
        label="Resize files"
        onDrag={setDraftWidth}
        onCommit={(next) => atox.settings.update({ terminalWidth: next })}
      />
    </aside>
  )
}

interface TreeLevelProps {
  directory: string
  depth: number
  tree: ReadonlyMap<string, DirectoryEntries>
  expanded: ReadonlySet<string>
  changed: { kinds: ReadonlyMap<string, FileChangeKind>; dirtyDirectories: ReadonlySet<string> }
  onToggle(directory: string): void
  onOpen(path: string): void
}

/** Одна папка дерева; вложенные рисуются, только когда раскрыты. */
function TreeLevel({ directory, depth, tree, expanded, changed, onToggle, onOpen }: TreeLevelProps) {
  const entries = tree.get(directory)
  if (!entries) {
    return null
  }
  const indent = { '--depth': depth } as CSSProperties
  return (
    <>
      {entries.directories.map((path) => {
        const open = expanded.has(path)
        const dirty = changed.dirtyDirectories.has(path)
        return (
          <li key={path} role="treeitem" aria-expanded={open}>
            <button
              type="button"
              className="file-tree__row"
              style={indent}
              title={path}
              onClick={() => onToggle(path)}
            >
              <ChevronRight className="file-tree__chevron" data-open={open} aria-hidden />
              {open ? (
                <FolderOpen className="file-tree__icon" aria-hidden />
              ) : (
                <Folder className="file-tree__icon" aria-hidden />
              )}
              <span className="file-tree__name">{baseName(path)}</span>
              {dirty && <span className="file-tree__dot" title="Contains changes" />}
            </button>
            {open && (
              <ul role="group">
                <TreeLevel
                  directory={path}
                  depth={depth + 1}
                  tree={tree}
                  expanded={expanded}
                  changed={changed}
                  onToggle={onToggle}
                  onOpen={onOpen}
                />
              </ul>
            )}
          </li>
        )
      })}
      {entries.files.map((path) => {
        const kind = changed.kinds.get(path)
        return (
          <li key={path} role="treeitem">
            <button
              type="button"
              className="file-tree__row"
              style={indent}
              title={path}
              data-kind={kind}
              onClick={() => onOpen(path)}
            >
              <span className="file-tree__chevron" aria-hidden />
              <FileIcon className="file-tree__icon" aria-hidden />
              <span className="file-tree__name">{baseName(path)}</span>
              {kind && (
                <span className="changed-file__kind" data-kind={kind} title={KIND_LABELS[kind]}>
                  {KIND_LETTERS[kind]}
                </span>
              )}
            </button>
          </li>
        )
      })}
    </>
  )
}

/** Содержимое файла с подсветкой; двоичные и огромные файлы не показываются. */
function FileViewer({ projectId, path }: { projectId: string; path: string }) {
  const [state, setState] = useState<FileState>({ kind: 'loading' })
  useEffect(() => {
    let disposed = false
    atox.projectFiles
      .read(projectId, path)
      .then((content) => !disposed && setState({ kind: 'loaded', content }))
      .catch(
        (error: unknown) =>
          !disposed && setState({ kind: 'failed', message: ipcErrorMessage(error) })
      )
    return () => {
      disposed = true
    }
  }, [projectId, path])

  if (state.kind === 'loading') {
    return <p className="changes-panel__message">Loading…</p>
  }
  if (state.kind === 'failed') {
    return (
      <p className="changes-panel__message" role="alert">
        Couldn’t open the file. {state.message}
      </p>
    )
  }
  const { content } = state
  switch (content.kind) {
    case 'text':
      return <CodeView path={path} content={content.content} />
    case 'binary':
      return <p className="changes-panel__message">This is a binary file — it can’t be shown.</p>
    case 'too-large':
      return (
        <p className="changes-panel__message">
          This file is too large to show ({formatSize(content.size)}).
        </p>
      )
    case 'missing':
      return <p className="changes-panel__message">The file no longer exists.</p>
  }
}

/** Папки и файлы каждой папки по плоскому списку путей; корень — пустая строка. */
function buildTree(files: readonly string[]): Map<string, DirectoryEntries> {
  const tree = new Map<string, DirectoryEntries>()
  const entriesOf = (directory: string) => {
    let entries = tree.get(directory)
    if (!entries) {
      entries = { directories: [], files: [] }
      tree.set(directory, entries)
    }
    return entries
  }
  for (const file of files) {
    let parent = ''
    for (let slash = file.indexOf('/'); slash > 0; slash = file.indexOf('/', slash + 1)) {
      const directory = file.slice(0, slash)
      if (!tree.has(directory)) {
        entriesOf(parent).directories.push(directory)
        entriesOf(directory)
      }
      parent = directory
    }
    entriesOf(parent).files.push(file)
  }
  const byName = (a: string, b: string) =>
    baseName(a).localeCompare(baseName(b), undefined, { numeric: true, sensitivity: 'base' })
  for (const entries of tree.values()) {
    entries.directories.sort(byName)
    entries.files.sort(byName)
  }
  return tree
}

export function baseName(path: string): string {
  return path.slice(path.lastIndexOf('/') + 1)
}

export function directoryOf(path: string): string {
  return path.slice(0, Math.max(0, path.lastIndexOf('/')))
}

function formatSize(bytes: number): string {
  return `${(bytes / (1024 * 1024)).toLocaleString('en-US', { maximumFractionDigits: 1 })} MB`
}
