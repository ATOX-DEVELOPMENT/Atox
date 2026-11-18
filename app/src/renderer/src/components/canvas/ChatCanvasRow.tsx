import { memo, type MouseEvent } from 'react'
import { LayoutDashboard } from 'lucide-react'
import {
  useCanvasNavigation,
  useChatCanvases,
  useChatCanvasOpened
} from '../../hooks/CanvasesContext'
import { showCanvasMenu } from '../../lib/canvasMenu'

interface ChatCanvasRowProps {
  chatId: string
  /** Строка под помощником: отступ как у его строки. */
  compact?: boolean
}

/**
 * Холст чата — одна строка под ним, со связующей линией; страницы холста выбираются на нём
 * самом. Холста нет или он в архиве — строки нет. Сам чат не меняется: холст открывается
 * своей строкой, на странице, где человек был в нём в прошлый раз.
 */
export const ChatCanvasRow = memo(function ChatCanvasRow({
  chatId,
  compact = false
}: ChatCanvasRowProps) {
  const pages = useChatCanvases(chatId)
  const opened = useChatCanvasOpened(chatId)
  const navigation = useCanvasNavigation()
  const [first] = pages
  if (!first) {
    return null
  }

  const openContextMenu = (event: MouseEvent) => {
    event.preventDefault()
    void showCanvasMenu(first, event, {
      withOpen: true,
      // Строка стоит под своим чатом: значит, чат есть.
      chatAvailable: true,
      navigation
    })
  }

  return (
    <div
      className="row row--canvas"
      data-compact={compact}
      data-active={opened}
      onContextMenu={openContextMenu}
    >
      <button
        type="button"
        className="row__main canvas-row"
        aria-current={opened ? 'page' : undefined}
        onClick={() => navigation.openChatCanvas(chatId)}
      >
        <LayoutDashboard className="icon canvas-row__icon" aria-hidden />
        <span className="row__label">Canvas</span>
        {pages.length > 1 && <span className="canvas-row__count">{pages.length} pages</span>}
      </button>
    </div>
  )
})
