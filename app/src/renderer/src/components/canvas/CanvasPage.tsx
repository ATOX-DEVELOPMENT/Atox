import { useCallback, useEffect, useRef, useState } from 'react'
import {
  useCanvas,
  useCanvasNavigation,
  useCanvasStore,
  useChatPages
} from '../../hooks/CanvasesContext'
import { useProjectsContext } from '../../hooks/ProjectsContext'
import { canvasOwner, chatLabel } from '../../lib/canvasOwner'
import { showCanvasMenu, showExportMenu, showShareMenu } from '../../lib/canvasMenu'
import { AgentBar } from './AgentBar'
import { CanvasEmpty } from './CanvasEmpty'
import { CanvasHeader } from './CanvasHeader'
import { CanvasStage, type CanvasStageHandle } from './CanvasStage'
import { HistoryDrawer } from './HistoryDrawer'
import { PagesPanel } from './PagesPanel'
import { ViewState } from './viewState'

interface CanvasPageProps {
  canvasId: string
  onClose(): void
}

/** Сколько кнопка Share показывает «ссылка скопирована», мс. */
const LINK_COPIED_MS = 2000

/**
 * Страница холста: шапка, поле с экранами открытой страницы, список страниц поверх него слева
 * и история версий справа.
 */
export function CanvasPage({ canvasId, onClose }: CanvasPageProps) {
  const canvas = useCanvas(canvasId)
  const store = useCanvasStore()
  const pages = useChatPages(canvas?.chatId ?? '')
  const { projects } = useProjectsContext()
  const navigation = useCanvasNavigation()
  const [viewState] = useState(() => new ViewState())
  const stageRef = useRef<CanvasStageHandle>(null)
  const [renaming, setRenaming] = useState(false)
  const [selectedScreenId, setSelectedScreenId] = useState<string | null>(null)
  const [historyOpen, setHistoryOpen] = useState(false)
  const [historyScreenId, setHistoryScreenId] = useState<string | null>(null)
  const [preview, setPreview] = useState<{ screenId: string; versionId: string } | null>(null)
  const [exporting, setExporting] = useState(false)
  const [publishing, setPublishing] = useState(false)
  const [linkCopied, setLinkCopied] = useState(false)

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
          setPreview(null)
        }}
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
              setPublishing(true)
              try {
                url = (await window.atox.canvas.share(canvas.id))?.url
              } finally {
                setPublishing(false)
              }
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
