import { useState, type CSSProperties, type MouseEvent } from 'react'
import { Pencil, Plus, Trash2 } from 'lucide-react'
import type { Space } from '../../../shared/models'
import { findProjectColor } from '../../../shared/projectColors'
import { useProjectsContext } from '../hooks/ProjectsContext'
import { colorSubmenu, parseColorAction } from '../lib/colorMenu'
import { showMenu, type MenuItem } from '../lib/menu'
import { InlineRename } from './InlineRename'

/** Сколько пространств доступно по ⌃1…⌃9. */
const NUMBERED_SPACES = 9

/**
 * Пространства вкладками в одну строку: клик переключает, правый клик открывает действия
 * над пространством, «+» создаёт новое и сразу предлагает назвать его прямо во вкладке.
 */
export function SpacePicker() {
  const { spaces, activeSpaceId, selectSpace, createSpace, renameSpace, setSpaceColor, removeSpace } =
    useProjectsContext()
  const [renamingId, setRenamingId] = useState<string | null>(null)

  const openMenu = async (space: Space, event: MouseEvent) => {
    event.preventDefault()
    const items: MenuItem<string>[] = [
      { action: 'rename', label: 'Rename Space', icon: <Pencil /> },
      colorSubmenu(space.color),
      ...(spaces.length > 1
        ? [
            {
              action: 'remove',
              label: 'Delete Space',
              icon: <Trash2 />,
              destructive: true
            } as const
          ]
        : [])
    ]
    const action = await showMenu(items, event)
    const color = parseColorAction(action)
    if (color !== undefined) {
      void setSpaceColor(space.id, color)
    } else if (action === 'rename') {
      setRenamingId(space.id)
    } else if (action === 'remove') {
      void removeSpace(space.id)
    }
  }

  const addSpace = async () => setRenamingId(await createSpace())

  return (
    <div className="space-tabs" role="tablist" aria-label="Spaces">
      {spaces.map((space, index) => {
        const color = findProjectColor(space.color)
        // Цвет задаётся сразу для обеих тем, а нужный выбирает CSS по текущей теме.
        const colorStyle = color
          ? ({ '--space-color': `light-dark(${color.light}, ${color.dark})` } as CSSProperties)
          : undefined
        if (space.id === renamingId) {
          return (
            <div key={space.id} className="space-tab space-tab--renaming" style={colorStyle}>
              <InlineRename
                value={space.name}
                label="Space name"
                onSubmit={(name) => {
                  setRenamingId(null)
                  void renameSpace(space.id, name)
                }}
                onCancel={() => setRenamingId(null)}
              />
            </div>
          )
        }
        return (
          <button
            key={space.id}
            type="button"
            role="tab"
            className="space-tab"
            style={colorStyle}
            aria-selected={space.id === activeSpaceId}
            title={index < NUMBERED_SPACES ? `${space.name} (Ctrl+${index + 1})` : space.name}
            onClick={() => selectSpace(space.id)}
            onDoubleClick={() => setRenamingId(space.id)}
            onContextMenu={(event) => void openMenu(space, event)}
          >
            <span className="space-tab__dot" aria-hidden />
            <span className="space-tab__name">{space.name}</span>
          </button>
        )
      })}
      <button
        type="button"
        className="space-tab space-tab--add"
        aria-label="New Space"
        title="New Space"
        onClick={() => void addSpace()}
      >
        <Plus className="icon" />
      </button>
    </div>
  )
}
