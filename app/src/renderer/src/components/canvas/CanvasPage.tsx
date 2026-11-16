import { useCallback, useEffect, useRef, useState } from 'react'
import { MousePointerClick } from 'lucide-react'
import { useCanvas, useCanvasNavigation } from '../../hooks/CanvasesContext'
import { useProjectsContext } from '../../hooks/ProjectsContext'
import { canvasOwner, chatLabel } from '../../lib/canvasOwner'
import { showCanvasMenu } from '../../lib/canvasMenu'
import { AgentBar } from './AgentBar'
import { CanvasEmpty } from './CanvasEmpty'
import { CanvasHeader } from './CanvasHeader'
import { CanvasStage, type CanvasStageHandle } from './CanvasStage'
import { HistoryDrawer } from './HistoryDrawer'
import { ViewState } from './viewState'

interface CanvasPageProps {
  canvasId: string
  onClose(): void
}

/** Страница холста: шапка, холст с экранами и история версий справа. */
export function CanvasPage({ canvasId, onClose }: CanvasPageProps) {
  const canvas = useCanvas(canvasId)
  const { projects } = useProjectsContext()
  const navigation = useCanvasNavigation()
  const [viewState] = useState(() => new ViewState())
  const stageRef = useRef<CanvasStageHandle>(null)
  const [renaming, setRenaming] = useState(false)
  const [selectedScreenId, setSelectedScreenId] = useState<string | null>(null)
  const [historyOpen, setHistoryOpen] = useState(false)
  const [historyScreenId, setHistoryScreenId] = useState<string | null>(null)
  const [preview, setPreview] = useState<{ screenId: string; versionId: string } | null>(null)

  useEffect(() => () => viewState.cancel(), [viewState])

  // Холст, который был на экране и пропал (его удалили), закрывает страницу. Только что
  // созданный холст может прийти чуть позже самой страницы — его ждём.
  const seenRef = useRef(false)
  useEffect(() => {
    if (canvas) {
      seenRef.current = true
    } else if (seenRef.current) {
      onClose()
    }
  }, [canvas, onClose])

  // Esc, который уже обработало поле (переименование, «Fix»), страницу не закрывает.
  useEffect(() => {
    const closeOnEscape = (event: KeyboardEvent) => {
      if (event.key === 'Escape' && !event.defaultPrevented) {
        onClose()
      }
    }
    window.addEventListener('keydown', closeOnEscape)
    return () => window.removeEventListener('keydown', closeOnEscape)
  }, [onClose])

  const selectScreen = useCallback((screenId: string | null) => {
    setSelectedScreenId(screenId)
    if (screenId) {
      setHistoryScreenId(screenId)
    }
  }, [])

  if (!canvas) {
    return <section className="canvas-page" aria-label="Canvas" />
  }

  const owner = canvasOwner(projects, canvas)
  const chatTitle = chatLabel(owner)
  const openChat = () => owner.chat && navigation.openChat(owner.chat.id)
  const hasScreens = canvas.screens.length > 0
  // Экран истории — выбранный последним, а если его уже нет — первый.
  const historyScreen = canvas.screens.find(({ id }) => id === historyScreenId) ?? canvas.screens[0]
  const shownPreview =
    historyOpen && preview && canvas.screens.some(({ id }) => id === preview.screenId)
      ? preview
      : null

  return (
    <section className="canvas-page" aria-label={`Canvas ${canvas.name}`}>
      <CanvasHeader
        canvas={canvas}
        owner={owner}
        viewState={viewState}
        renaming={renaming}
        onRenamingChange={setRenaming}
        historyOpen={historyOpen && hasScreens}
        onToggleHistory={() => setHistoryOpen((open) => !open)}
        onFit={() => stageRef.current?.fit()}
        onResetZoom={() => stageRef.current?.resetZoom()}
        onOpenChat={openChat}
        onOpenMenu={(event) =>
          void showCanvasMenu(canvas, event.currentTarget, {
            withOpen: false,
            chatAvailable: Boolean(owner.chat),
            renameLabel: 'Rename canvas',
            navigation,
            onRename: () => setRenaming(true)
          })
        }
      />
      <div className="canvas-page__body">
        {hasScreens ? (
          <CanvasStage
            ref={stageRef}
            canvas={canvas}
            viewState={viewState}
            selectedScreenId={selectedScreenId}
            onSelectScreen={selectScreen}
            preview={shownPreview}
            chatTitle={chatTitle}
          >
            <p className="canvas-hint" data-canvas-ui>
              <MousePointerClick className="icon" aria-hidden />
              <span className="canvas-hint__text">
                Click a screen to fix it · Drag to move · Double-click a name to rename
              </span>
            </p>
            {owner.chat && (
              <AgentBar chatId={owner.chat.id} chatTitle={chatTitle} onOpenChat={openChat} />
            )}
          </CanvasStage>
        ) : (
          <CanvasEmpty
            canvasId={canvas.id}
            chatTitle={owner.chat ? chatTitle : null}
            onOpenChat={openChat}
          />
        )}
        {historyOpen && historyScreen && (
          <HistoryDrawer
            // У каждого экрана свой список: другой экран загружается с чистого листа.
            key={historyScreen.id}
            canvasId={canvas.id}
            canvasName={canvas.name}
            screens={canvas.screens}
            screenId={historyScreen.id}
            onScreenChange={setHistoryScreenId}
            previewVersionId={
              shownPreview?.screenId === historyScreen.id ? shownPreview.versionId : null
            }
            onPreview={(versionId) =>
              setPreview(versionId ? { screenId: historyScreen.id, versionId } : null)
            }
          />
        )}
      </div>
    </section>
  )
}
