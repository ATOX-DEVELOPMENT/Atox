import { useCallback, useEffect, useRef, useState } from 'react'
import {
  useCanvas,
  useCanvasNavigation,
  useCanvasStore,
  useChatPages,
  useChatSharing
} from '../../hooks/CanvasesContext'
import { useProjectsContext } from '../../hooks/ProjectsContext'
import { canvasOwner, chatLabel } from '../../lib/canvasOwner'
import { showCanvasMenu, showExportMenu, showShareMenu } from '../../lib/canvasMenu'
import { AgentBar } from './AgentBar'
import { CanvasEmpty, type CanvasChatState } from './CanvasEmpty'
import { CanvasHeader } from './CanvasHeader'
import { CanvasStage, type CanvasStageHandle } from './CanvasStage'
import { HistoryDrawer } from './HistoryDrawer'
import { PagesPanel } from './PagesPanel'
import { ToolsDrawer } from './ToolsDrawer'
import { ScreenSizeDialog } from './ScreenSizeDialog'
import { useStandaloneCanvas } from './useStandaloneCanvas'
import { ViewState } from './viewState'

interface CanvasPageProps {
  canvasId: string
  onClose(): void
}

/** Сколько кнопка Share показывает «ссылка скопирована», мс. */
const LINK_COPIED_MS = 2000

/**
 * Страница холста: шапка, поле с экранами открытой страницы, список страниц поверх него слева
 * и справа история версий или вкладка Tools (сетка).
 */
export function CanvasPage({ canvasId, onClose }: CanvasPageProps) {
  const canvas = useCanvas(canvasId)
  const store = useCanvasStore()
  const pages = useChatPages(canvas?.chatId ?? '')
  // Публикация идёт в main: кнопка занята, пока она не кончится, даже если страницу открыли заново.
  const publishing = useChatSharing(canvas?.chatId ?? '')
  const { projects } = useProjectsContext()
  const navigation = useCanvasNavigation()
  const [viewState] = useState(() => new ViewState())
  const stageRef = useRef<CanvasStageHandle>(null)
  const [renaming, setRenaming] = useState(false)
  const [selectedScreenId, setSelectedScreenId] = useState<string | null>(null)
  // История и Tools стоят справа на одном месте: открыта одна из них.
  const [historyOpen, setHistoryOpen] = useState(false)
  const [toolsOpen, setToolsOpen] = useState(false)
  const [historyScreenId, setHistoryScreenId] = useState<string | null>(null)
  const [preview, setPreview] = useState<{ screenId: string; versionId: string } | null>(null)
  const [exporting, setExporting] = useState(false)
  const [linkCopied, setLinkCopied] = useState(false)
  const [addingScreen, setAddingScreen] = useState(false)
  const standalone = useStandaloneCanvas()

  useEffect(() => () => viewState.cancel(), [viewState])

  // Ссылка в буфере: кнопка на пару секунд показывает галочку.
  useEffect(() => {
    if (!linkCopied) {
      return undefined
    }
    const timer = window.setTimeout(() => setLinkCopied(false), LINK_COPIED_MS)
    return () => window.clearTimeout(timer)
  }, [linkCopied])

  // Страница, которая была на экране и пропала (её удалили), уступает место другой странице
  // холста, а если страниц не осталось — закрывается. Только что созданная страница может
  // прийти чуть позже самого экрана — её ждём.
  const seenChatRef = useRef<string | null>(null)
  useEffect(() => {
    if (canvas) {
      seenChatRef.current = canvas.chatId
    } else if (seenChatRef.current !== null) {
      const next = store.entryPage(seenChatRef.current)
      if (next) {
        navigation.openCanvas(next.id)
      } else {
        onClose()
      }
    }
  }, [canvas, store, navigation, onClose])

  // Esc, который уже обработало поле (переименование, «Fix»), страницу не закрывает.
  useEffect(() => {
    if (addingScreen) {
      // Окно пустого экрана закрывается своим Esc, страница остаётся.
      return undefined
    }
    const closeOnEscape = (event: KeyboardEvent) => {
      if (event.key === 'Escape' && !event.defaultPrevented) {
        onClose()
      }
    }
    window.addEventListener('keydown', closeOnEscape)
    return () => window.removeEventListener('keydown', closeOnEscape)
  }, [onClose, addingScreen])

  const selectScreen = useCallback((screenId: string | null) => {
    setSelectedScreenId(screenId)
    if (screenId) {
      setHistoryScreenId(screenId)
    }
  }, [])

  // Клик по экрану подводит к нему вид, закрывает «Fix» и переключает историю на этот экран.
  const focusScreen = useCallback((screenId: string) => {
    setSelectedScreenId(null)
    setHistoryScreenId(screenId)
  }, [])

  if (!canvas) {
    return <section className="canvas-page" aria-label="Canvas" />
  }

  const owner = canvasOwner(projects, canvas)
  const chatTitle = chatLabel(owner)
  const openChat = () => owner.chat && navigation.openChat(owner.chat.id)
  const chatState: CanvasChatState = owner.chat
    ? { kind: 'linked', title: owner.chat.title }
    : owner.standalone
      ? { kind: 'none' }
      : { kind: 'deleted' }
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
        onToggleHistory={() => {
          // Закрытая история возвращает экранам текущие версии.
          setHistoryOpen((open) => !open)
          setToolsOpen(false)
          setPreview(null)
        }}
        toolsOpen={toolsOpen && hasScreens}
        onToggleTools={() => {
          setToolsOpen((open) => !open)
          setHistoryOpen(false)
          setPreview(null)
        }}
        onAddScreen={() => setAddingScreen(true)}
        onFit={() => stageRef.current?.fit()}
        onResetZoom={() => stageRef.current?.resetZoom()}
        exporting={exporting}
        onExport={(event) => {
          const anchor = event.currentTarget
          void (async () => {
            const format = await showExportMenu(anchor)
            if (!format) {
              return
            }
            setExporting(true)
            try {
              await window.atox.canvas.export(canvas.id, format)
            } finally {
              setExporting(false)
            }
          })()
        }}
        publishing={publishing}
        linkCopied={linkCopied}
        onShare={(event) => {
          const anchor = event.currentTarget
          void (async () => {
            // Опубликованный холст предлагает меню; неопубликованный публикуется сразу.
            const action = canvas.share ? await showShareMenu(anchor) : 'update'
            if (!action) {
              return
            }
            if (action === 'stop') {
              await window.atox.canvas.stopSharing(canvas.id)
              return
            }
            if (action === 'open' && canvas.share) {
              window.open(canvas.share.url)
              return
            }
            let url = canvas.share?.url
            if (action === 'update' || !url) {
              url = (await window.atox.canvas.share(canvas.id))?.url
            }
            if (url) {
              await navigator.clipboard.writeText(url)
              setLinkCopied(true)
            }
          })()
        }}
        onOpenMenu={(event) =>
          void showCanvasMenu(canvas, event.currentTarget, {
            withOpen: false,
            chatAvailable: Boolean(owner.chat),
            navigation,
            standalone,
            onRename: () => setRenaming(true)
          })
        }
      />
      <div className="canvas-page__body">
        <PagesPanel chatId={canvas.chatId} pages={pages} activeId={canvas.id} />
        {hasScreens ? (
          <CanvasStage
            ref={stageRef}
            canvas={canvas}
            viewState={viewState}
            selectedScreenId={selectedScreenId}
            onSelectScreen={selectScreen}
            onFocusScreen={focusScreen}
            preview={shownPreview}
            chatTitle={chatTitle}
          >
            {owner.chat && (
              <AgentBar chatId={owner.chat.id} chatTitle={chatTitle} onOpenChat={openChat} />
            )}
          </CanvasStage>
        ) : (
          <CanvasEmpty
            canvasId={canvas.id}
            chat={chatState}
            onOpenChat={openChat}
            onAddScreen={() => setAddingScreen(true)}
            onStartAgent={() => void standalone.startAgent(canvas)}
            onLinkChat={(event) => void standalone.linkChat(canvas, event.currentTarget)}
          />
        )}
        {toolsOpen && hasScreens && <ToolsDrawer canvasId={canvas.id} grid={canvas.grid} />}
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
      {addingScreen && (
        <ScreenSizeDialog
          mode="screen"
          onSubmit={async ({ look }) => {
            await window.atox.canvas.addBlankScreen(canvas.id, look)
            setAddingScreen(false)
          }}
          onClose={() => setAddingScreen(false)}
        />
      )}
    </section>
  )
}
