import { memo, useState } from 'react'
import { Ellipsis } from 'lucide-react'
import { CANVAS_NAME_MAX_LENGTH, type Canvas } from '../../../../shared/canvas'
import { useCanvasNavigation } from '../../hooks/CanvasesContext'
import { showCanvasMenu } from '../../lib/canvasMenu'
import { CHAT_DELETED_LABEL } from '../../lib/canvasOwner'
import { formatFullDate, formatRelativeTime } from '../../lib/relativeTime'
import { InlineRename } from '../InlineRename'
import { CanvasThumbnail } from './CanvasThumbnail'

interface CanvasCardProps {
  canvas: Canvas
  /** Проекта нет — его убрали из списка. */
  projectName: string | undefined
  /** Чата нет — его удалили или убрали в архив. */
  chatTitle: string | undefined
  now: number
}

/** Карточка холста в списке: схема экранов, имя, проект, чат, число экранов и время правки. */
export const CanvasCard = memo(function CanvasCard({
  canvas,
  projectName,
  chatTitle,
  now
}: CanvasCardProps) {
  const navigation = useCanvasNavigation()
  const [renaming, setRenaming] = useState(false)
  const count = canvas.screens.length
  const details = [
    projectName,
    chatTitle === undefined ? CHAT_DELETED_LABEL : `chat ${chatTitle}`,
    count === 1 ? '1 screen' : `${count} screens`
  ]
    .filter(Boolean)
    .join(' · ')

  return (
    <li className="canvas-card" data-archived={canvas.archived}>
      <button
        type="button"
        className="canvas-card__open"
        aria-label={`Open ${canvas.name}`}
        onClick={() => navigation.openCanvas(canvas.id)}
      >
        <CanvasThumbnail screens={canvas.screens} />
      </button>
      <div className="canvas-card__info">
        {renaming ? (
          <InlineRename
            value={canvas.name}
            label="Canvas name"
            onSubmit={(name) => {
              setRenaming(false)
              void window.atox.canvas.rename(canvas.id, name.slice(0, CANVAS_NAME_MAX_LENGTH))
            }}
            onCancel={() => setRenaming(false)}
          />
        ) : (
          <h2 className="canvas-card__name" title={canvas.name}>
            {canvas.name}
          </h2>
        )}
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
        aria-label={`More actions for ${canvas.name}`}
        title="More"
        onClick={(event) =>
          void showCanvasMenu(canvas, event.currentTarget, {
            withOpen: true,
            chatAvailable: chatTitle !== undefined,
            navigation,
            onRename: () => setRenaming(true)
          })
        }
      >
        <Ellipsis className="icon" />
      </button>
    </li>
  )
})
