import { memo, useState, type CSSProperties, type MouseEvent, type PointerEvent } from 'react'
import { EllipsisVertical, Pencil, Ungroup } from 'lucide-react'
import { CANVAS_NAME_MAX_LENGTH, type CanvasGroup } from '../../../../shared/canvas'
import type { Rect } from '../../lib/canvasView'
import { showMenu } from '../../lib/menu'
import { InlineRename } from '../InlineRename'

type GroupAction = 'rename' | 'ungroup'

interface GroupFrameProps {
  canvasId: string
  group: CanvasGroup
  /** Рамка группы на холсте: её экраны с полями. */
  rect: Rect
  /** Группу тянут прямо сейчас. */
  dragging: boolean
  onPointerDown(groupId: string, event: PointerEvent<HTMLElement>): void
  /** Подводит холст к группе — с клавиатуры; мышью это решает `onPointerDown`. */
  onFocus(groupId: string): void
}

/**
 * Группа на холсте: скруглённая рамка с названием, иконкой и меню «⋮» вокруг её экранов.
 * Рамка лежит под экранами и не ловит мышь — по ней холст двигается, как по пустому месту; ловит
 * только заголовок: протяжка переносит всю группу, клик подводит к ней, меню переименовывает или
 * распускает. Заголовок не масштабируется вместе с холстом.
 */
export const GroupFrame = memo(function GroupFrame({
  canvasId,
  group,
  rect,
  dragging,
  onPointerDown,
  onFocus
}: GroupFrameProps) {
  const [renaming, setRenaming] = useState(false)
  const style = {
    transform: `translate(${rect.x}px, ${rect.y}px)`,
    width: rect.width,
    height: rect.height
  } as CSSProperties

  const rename = (name: string) => {
    setRenaming(false)
    void window.atox.canvas.renameGroup(canvasId, group.id, name.slice(0, CANVAS_NAME_MAX_LENGTH))
  }

  const openMenu = async (event: MouseEvent<HTMLElement>) => {
    event.preventDefault()
    event.stopPropagation()
    const action = await showMenu<GroupAction>(
      [
        { action: 'rename', label: 'Rename', icon: <Pencil /> },
        { action: 'ungroup', label: 'Ungroup', icon: <Ungroup /> }
      ],
      event
    )
    if (action === 'rename') {
      setRenaming(true)
    } else if (action === 'ungroup') {
      void window.atox.canvas.ungroup(canvasId, group.id)
    }
  }

  return (
    <div className="canvas-group" data-group-id={group.id} data-dragging={dragging} style={style}>
      <div className="canvas-group__header">
        {renaming ? (
          <InlineRename
            value={group.name}
            label="Group name"
            onSubmit={rename}
            onCancel={() => setRenaming(false)}
          />
        ) : (
          <button
            type="button"
            className="canvas-group__title"
            title={`${group.name} — click to go to the group, drag to move it, double-click to rename`}
            onPointerDown={(event) => onPointerDown(group.id, event)}
            onContextMenu={(event) => void openMenu(event)}
            onDoubleClick={() => setRenaming(true)}
            // Клик мышью уже обработан протяжкой; здесь — Enter и пробел (у них `detail` равен 0).
            onClick={(event) => event.detail === 0 && onFocus(group.id)}
          >
            <span className="canvas-group__name">{group.name}</span>
          </button>
        )}
        <button
          type="button"
          className="canvas-group__menu"
          aria-label={`${group.name} actions`}
          aria-haspopup="menu"
          onPointerDown={(event) => event.stopPropagation()}
          onClick={(event) => void openMenu(event)}
        >
          <EllipsisVertical className="icon" aria-hidden />
        </button>
      </div>
    </div>
  )
})
