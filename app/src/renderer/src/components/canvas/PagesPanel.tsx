import { useEffect, useState, type KeyboardEvent, type MouseEvent } from 'react'
import { Ellipsis, GripVertical, PanelLeftClose, PanelLeftOpen, Pencil, Plus, Trash2 } from 'lucide-react'
import { CANVAS_NAME_MAX_LENGTH, type Canvas } from '../../../../shared/canvas'
import { useCanvasNavigation } from '../../hooks/CanvasesContext'
import { showMenu } from '../../lib/menu'
import { InlineRename } from '../InlineRename'
import { SortableList, useSortableItem } from '../SortableList'
import { CanvasThumbnail } from './CanvasThumbnail'

/** Ключ, под которым запоминается, свёрнута ли панель: она одна на все холсты. */
const COLLAPSED_KEY = 'atox.canvas.pagesCollapsed'

interface PagesPanelProps {
  chatId: string
  /** Страницы холста чата, в их порядке. */
  pages: readonly Canvas[]
  /** Страница, открытая сейчас. */
  activeId: string
}

type PageAction = 'rename' | 'remove'

function screenCount(page: Canvas): string {
  const count = page.screens.length
  return count === 0 ? 'empty' : count === 1 ? '1 screen' : `${count} screens`
}

/**
 * Страницы холста: плашка поверх холста со списком страниц, кнопкой «+» и перетаскиванием
 * порядка. Клик открывает страницу, двойной клик по названию или меню «⋯» переименовывает
 * и удаляет. Плашка сворачивается в кнопку.
 */
export function PagesPanel({ chatId, pages, activeId }: PagesPanelProps) {
  const navigation = useCanvasNavigation()
  const [collapsed, setCollapsed] = useState(() => localStorage.getItem(COLLAPSED_KEY) === '1')
  const [renamingId, setRenamingId] = useState<string | null>(null)
  const [adding, setAdding] = useState(false)

  useEffect(() => {
    localStorage.setItem(COLLAPSED_KEY, collapsed ? '1' : '0')
  }, [collapsed])

  const addPage = async () => {
    if (adding) {
      return
    }
    setAdding(true)
    try {
      navigation.openCanvas(await window.atox.canvas.addPage(chatId))
    } finally {
      setAdding(false)
    }
  }

  const movePage = (id: string, toIndex: number) => {
    const ids = pages.map((page) => page.id).filter((pageId) => pageId !== id)
    ids.splice(toIndex, 0, id)
    void window.atox.canvas.reorderPages(chatId, ids)
  }

  if (collapsed) {
    return (
      <button
        type="button"
        className="pages-panel pages-panel--collapsed"
        title="Show pages"
        aria-label={`Show pages (${pages.length})`}
        onClick={() => setCollapsed(false)}
      >
        <PanelLeftOpen className="icon" aria-hidden />
        <span>Pages</span>
        <span className="pages-panel__count">{pages.length}</span>
      </button>
    )
  }

  return (
    <aside className="pages-panel" aria-label="Pages">
      <header className="pages-panel__header">
        <h2 className="pages-panel__title">
          Pages
          <span className="pages-panel__count">{pages.length}</span>
        </h2>
        <button
          type="button"
          className="pages-panel__button"
          title="Add page"
          aria-label="Add page"
          disabled={adding}
          onClick={() => void addPage()}
        >
          <Plus className="icon" />
        </button>
        <button
          type="button"
          className="pages-panel__button"
          title="Hide pages"
          aria-label="Hide pages"
          onClick={() => setCollapsed(true)}
        >
          <PanelLeftClose className="icon" />
        </button>
      </header>
      <div className="pages-panel__list">
        <SortableList items={pages} onMove={movePage}>
          {(page) => (
            <PageItem
              key={page.id}
              page={page}
              active={page.id === activeId}
              renaming={renamingId === page.id}
              canRemove={pages.length > 1}
              onRenamingChange={(renaming) => setRenamingId(renaming ? page.id : null)}
            />
          )}
        </SortableList>
      </div>
    </aside>
  )
}

interface PageItemProps {
  page: Canvas
  active: boolean
  renaming: boolean
  /** Последнюю страницу удалить нельзя: холст без страниц не бывает. */
  canRemove: boolean
  onRenamingChange(renaming: boolean): void
}

function PageItem({ page, active, renaming, canRemove, onRenamingChange }: PageItemProps) {
  const navigation = useCanvasNavigation()
  const { itemProps, handleProps } = useSortableItem(page.id, renaming)

  const openMenu = async (event: MouseEvent<HTMLElement>) => {
    event.preventDefault()
    event.stopPropagation()
    const action = await showMenu<PageAction>(
      [
        { action: 'rename', label: 'Rename', icon: <Pencil /> },
        { type: 'separator' },
        {
          action: 'remove',
          label: 'Delete…',
          icon: <Trash2 />,
          destructive: true,
          enabled: canRemove
        }
      ],
      // Правая кнопка открывает меню у курсора, кнопка «⋯» — под собой.
      event.type === 'contextmenu' ? event : event.currentTarget
    )
    if (action === 'rename') {
      onRenamingChange(true)
    } else if (action === 'remove') {
      void window.atox.canvas.remove(page.id)
    }
  }

  const open = () => {
    if (!active && !renaming) {
      navigation.openCanvas(page.id)
    }
  }

  const openOnKey = (event: KeyboardEvent<HTMLElement>) => {
    // Enter и пробел в поле переименования принадлежат полю.
    if ((event.key === 'Enter' || event.key === ' ') && event.target === event.currentTarget) {
      event.preventDefault()
      open()
    }
  }

  const rename = (name: string) => {
    onRenamingChange(false)
    void window.atox.canvas.rename(page.id, name.slice(0, CANVAS_NAME_MAX_LENGTH)).catch(() => {
      // Имя уже занято другой страницей: остаётся прежнее.
    })
  }

  return (
    <li {...itemProps} className="pages-panel__item" data-active={active} onContextMenu={openMenu}>
      <span className="pages-panel__grip" aria-hidden {...handleProps}>
        <GripVertical className="icon" />
      </span>
      {/* Не кнопка: внутри может быть поле переименования, а поле в кнопке — неверная разметка. */}
      <div
        role="button"
        tabIndex={0}
        className="pages-panel__open"
        aria-current={active ? 'page' : undefined}
        onClick={open}
        onKeyDown={openOnKey}
      >
        <span className="pages-panel__thumbnail">
          <CanvasThumbnail screens={page.screens} />
        </span>
        <span className="pages-panel__text">
          {renaming ? (
            <InlineRename
              value={page.name}
              label="Page name"
              onSubmit={rename}
              onCancel={() => onRenamingChange(false)}
            />
          ) : (
            <span
              className="pages-panel__name"
              title={page.name}
              onDoubleClick={() => onRenamingChange(true)}
            >
              {page.name}
            </span>
          )}
          <span className="pages-panel__meta">{screenCount(page)}</span>
        </span>
      </div>
      <button
        type="button"
        className="pages-panel__button pages-panel__more"
        title="More"
        aria-label={`More actions for ${page.name}`}
        onClick={openMenu}
      >
        <Ellipsis className="icon" />
      </button>
    </li>
  )
}
