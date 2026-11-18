import { memo } from 'react'
import { Ellipsis } from 'lucide-react'
import { useCanvasNavigation } from '../../hooks/CanvasesContext'
import { showCanvasMenu } from '../../lib/canvasMenu'
import { CHAT_DELETED_LABEL } from '../../lib/canvasOwner'
import type { ChatCanvas } from '../../lib/chatCanvas'
import { formatFullDate, formatRelativeTime } from '../../lib/relativeTime'
import { CanvasThumbnail } from './CanvasThumbnail'

interface CanvasCardProps {
  canvas: ChatCanvas
  /** Проекта нет — его убрали из списка. */
  projectName: string | undefined
  /** Чата нет — его удалили или убрали в архив. */
  chatTitle: string | undefined
  now: number
}

/** Подпись «3 pages». */
function plural(count: number, noun: string): string {
  return `${count} ${noun}${count === 1 ? '' : 's'}`
}

/**
 * Карточка холста чата в списке: схема экранов первой страницы, название чата, проект, число
 * страниц и экранов и время правки. Страницы выбираются уже на самом холсте.
 */
export const CanvasCard = memo(function CanvasCard({
  canvas,
  projectName,
  chatTitle,
  now
}: CanvasCardProps) {
  const navigation = useCanvasNavigation()
  const [first] = canvas.pages
  if (!first) {
    return null
  }
  const name = chatTitle ?? first.name
  const details = [
    projectName,
    chatTitle === undefined && CHAT_DELETED_LABEL,
    canvas.pages.length > 1 && plural(canvas.pages.length, 'page'),
    plural(canvas.screenCount, 'screen')
  ]
    .filter(Boolean)
    .join(' · ')

  return (
    <li className="canvas-card" data-archived={canvas.archived}>
      <button
        type="button"
        className="canvas-card__open"
        aria-label={`Open ${name}`}
        onClick={() => navigation.openChatCanvas(canvas.chatId)}
      >
        <CanvasThumbnail screens={first.screens} />
      </button>
      <div className="canvas-card__info">
        <h2 className="canvas-card__name" title={name}>
          {name}
        </h2>
        <p className="canvas-card__details" title={details}>
          <span className="canvas-card__place">{details}</span>
          <span aria-hidden> · </span>
          <time
            dateTime={new Date(canvas.updatedAt).toISOString()}
            title={formatFullDate(canvas.updatedAt)}
          >
            {formatRelativeTime(canvas.updatedAt, now)}
          </time>
        </p>
      </div>
      <button
        type="button"
        className="canvas-card__menu"
        aria-label={`More actions for ${name}`}
        title="More"
        onClick={(event) =>
          void showCanvasMenu(first, event.currentTarget, {
            withOpen: true,
            chatAvailable: chatTitle !== undefined,
            navigation
          })
        }
      >
        <Ellipsis className="icon" />
      </button>
    </li>
  )
})
