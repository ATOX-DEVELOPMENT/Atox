import { memo, useState, type MouseEvent } from 'react'
import { LayoutDashboard } from 'lucide-react'
import { CANVAS_NAME_MAX_LENGTH } from '../../../../shared/canvas'
import {
  useCanvasNavigation,
  useCanvasOpened,
  useChatCanvas
} from '../../hooks/CanvasesContext'
import { showCanvasMenu } from '../../lib/canvasMenu'
import { InlineRename } from '../InlineRename'

interface ChatCanvasRowProps {
  chatId: string
  /** Строка под помощником: отступ как у его строки. */
  compact?: boolean
}

/**
 * Холст чата — строка под ним, со связующей линией. Холста нет или он в архиве — строки нет.
 * Сам чат не меняется: холст открывается своей строкой.
 */
export const ChatCanvasRow = memo(function ChatCanvasRow({
  chatId,
  compact = false
}: ChatCanvasRowProps) {
  const canvas = useChatCanvas(chatId)
  const opened = useCanvasOpened(canvas?.id ?? '')
  const navigation = useCanvasNavigation()
  const [renaming, setRenaming] = useState(false)

  if (!canvas) {
    return null
  }

  const rename = (name: string) => {
    setRenaming(false)
    void window.atox.canvas.rename(canvas.id, name.slice(0, CANVAS_NAME_MAX_LENGTH))
  }

  const openContextMenu = (event: MouseEvent) => {
    event.preventDefault()
    void showCanvasMenu(canvas, event, {
      withOpen: true,
      // Строка стоит под своим чатом: значит, чат есть.
      chatAvailable: true,
      navigation,
      onRename: () => setRenaming(true)
    })
  }

  const icon = <LayoutDashboard className="icon canvas-row__icon" aria-hidden />

  return (
    <div
      className="row row--canvas"
      data-compact={compact}
      data-active={opened}
      onContextMenu={openContextMenu}
    >
      {renaming ? (
        <div className="row__main canvas-row">
          {icon}
          <InlineRename
            value={canvas.name}
            label="Canvas name"
            onSubmit={rename}
            onCancel={() => setRenaming(false)}
          />
        </div>
      ) : (
        <button
          type="button"
          className="row__main canvas-row"
          aria-current={opened ? 'page' : undefined}
          onClick={() => navigation.openCanvas(canvas.id)}
          onDoubleClick={() => setRenaming(true)}
        >
          {icon}
          <span className="row__label">{canvas.name}</span>
        </button>
      )}
    </div>
  )
})
