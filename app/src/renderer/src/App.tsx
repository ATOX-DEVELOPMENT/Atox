import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import type { RepositorySection } from './components/RepositoryView'
import { MenuLayer } from './components/MenuLayer'
import { SettingsView, type SettingsSection } from './components/SettingsView'
import { Sidebar } from './components/Sidebar'
import { WindowPill } from './components/WindowPill'
import { BackgroundTasksProvider } from './hooks/BackgroundTasksContext'
import { Workspace, type SidePanel, type WorkspacePage } from './components/Workspace'
import {
  CanvasesProvider,
  CanvasNavigationProvider,
  useCanvasStore,
  type CanvasNavigation
} from './hooks/CanvasesContext'
import { ChatActivityProvider, useChatsCovered } from './hooks/ChatActivityContext'
import { ProjectsProvider, useProjectsContext } from './hooks/ProjectsContext'
import { SettingsProvider } from './hooks/SettingsContext'
import { useAppCommands } from './hooks/useAppCommands'
import { useTerminalPanel } from './hooks/useTerminalPanel'

export function App() {
  return (
    <SettingsProvider>
      <ProjectsProvider>
        <ChatActivityProvider>
          <CanvasesProvider>
            <BackgroundTasksProvider>
              <Layout />
            </BackgroundTasksProvider>
            <MenuLayer />
          </CanvasesProvider>
        </ChatActivityProvider>
      </ProjectsProvider>
    </SettingsProvider>
  )
}

function Layout() {
  const projects = useProjectsContext()
  const [sidebarVisible, setSidebarVisible] = useState(true)
  const [page, setPage] = useState<WorkspacePage | null>(null)
  // Настройки — окно поверх приложения, а не страница: под ним остаётся то, что было открыто.
  const [settingsSection, setSettingsSection] = useState<SettingsSection | null>(null)
  // Раздел страницы репозитория не сбрасывается, когда её закрывают и открывают снова.
  const [repositorySection, setRepositorySection] = useState<RepositorySection>('pulls')
  const terminals = useTerminalPanel()
  // Изменения или файлы показываются вместо терминала, у текущего проекта.
  const [sidePanel, setSidePanel] = useState<SidePanel | null>(null)
  // Растёт с каждым ⌘P: панель файлов открывает поиск файла.
  const [quickOpenRequest, setQuickOpenRequest] = useState(0)
  const { currentProjectId } = projects

  const toggleSidebar = useCallback(() => setSidebarVisible((visible) => !visible), [])
  const openSettings = useCallback(
    (section: SettingsSection = 'general') => setSettingsSection(section),
    []
  )
  const closeSettings = useCallback(() => setSettingsSection(null), [])
  const toggleAgents = useCallback(
    () => setPage((current) => (current?.kind === 'agents' ? null : { kind: 'agents' })),
    []
  )
  const toggleBoard = useCallback(
    () => setPage((current) => (current?.kind === 'board' ? null : { kind: 'board' })),
    []
  )
  // Выбранный в обзоре чат мог уже быть активным — тогда страница сама не закроется.
  const openChat = useCallback(
    (chatId: string) => {
      projects.selectChat(chatId)
      setPage(null)
    },
    [projects.selectChat]
  )
  const closePage = useCallback(() => setPage(null), [])
  const toggleCanvasList = useCallback(
    () => setPage((current) => (current?.kind === 'canvasList' ? null : { kind: 'canvasList' })),
    []
  )
  const canvasStore = useCanvasStore()
  const canvasNavigation = useMemo<CanvasNavigation>(
    () => ({
      openCanvas: (canvasId) => setPage({ kind: 'canvas', canvasId }),
      openChatCanvas: (chatId) => {
        void (async () => {
          const canvasId =
            canvasStore.entryPage(chatId)?.id ?? (await window.atox.canvas.create(chatId))
          setPage({ kind: 'canvas', canvasId })
        })()
      },
      openCanvasList: () => setPage({ kind: 'canvasList' }),
      openChat
    }),
    [openChat, canvasStore]
  )
  // Строка открытого холста в сайдбаре подсвечена; узнаёт она об этом из хранилища холстов.
  const openedCanvasId = page?.kind === 'canvas' ? page.canvasId : null
  useEffect(() => canvasStore.setOpened(openedCanvasId), [canvasStore, openedCanvasId])
  const openRepository = useCallback(
    (projectId: string) => setPage({ kind: 'repository', projectId }),
    []
  )
  // Кнопка и горячая клавиша открывают репозиторий текущего проекта, а повторно — закрывают.
  const toggleRepository = useCallback(() => {
    setPage((current) =>
      current?.kind === 'repository' || !currentProjectId
        ? null
        : { kind: 'repository', projectId: currentProjectId }
    )
  }, [currentProjectId])

  // Терминал открывается у текущего проекта; поверх страницы его не видно — страница закрывается.
  // Если на его месте были изменения, они уступают место уже открытому терминалу.
  const toggleTerminal = useCallback(() => {
    if (!currentProjectId) {
      return
    }
    setPage(null)
    if (sidePanel) {
      setSidePanel(null)
      if (terminals.openProjectIds.includes(currentProjectId)) {
        return
      }
    }
    terminals.toggle(currentProjectId)
  }, [currentProjectId, sidePanel, terminals.openProjectIds, terminals.toggle])

  const toggleChanges = useCallback(() => {
    if (currentProjectId) {
      setPage(null)
      setSidePanel((open) => (open === 'changes' ? null : 'changes'))
    }
  }, [currentProjectId])

  const toggleFiles = useCallback(() => {
    if (currentProjectId) {
      setPage(null)
      setSidePanel((open) => (open === 'files' ? null : 'files'))
    }
  }, [currentProjectId])

  const toggleTasks = useCallback(() => {
    if (currentProjectId) {
      setPage(null)
      setSidePanel((open) => (open === 'tasks' ? null : 'tasks'))
    }
  }, [currentProjectId])

  // Таблетка у поля ввода только открывает список: повторный клик не должен его прятать.
  const showTasks = useCallback(() => {
    setPage(null)
    setSidePanel('tasks')
  }, [])

  const quickOpen = useCallback(() => {
    if (currentProjectId) {
      setPage(null)
      setSidePanel('files')
      setQuickOpenRequest((request) => request + 1)
    }
  }, [currentProjectId])

  // Переход в чат (выбор, создание, переключение с клавиатуры) закрывает страницу поверх чатов.
  // Открытый чат, который удалили, переходом не считается: например, задачу на доске перенесли
  // в Done, и чат её агента убран, — доска остаётся на экране.
  const previousChatIdRef = useRef(projects.activeChatId)
  useEffect(() => {
    const previous = previousChatIdRef.current
    previousChatIdRef.current = projects.activeChatId
    const previousRemoved =
      previous !== null &&
      !projects.projects.some(({ chats }) => chats.some(({ id }) => id === previous))
    if (projects.activeChatId !== previous && !previousRemoved) {
      closePage()
    }
  }, [projects.activeChatId, projects.projects, closePage])

  // Клик по чату закрывает страницу и тогда, когда чат уже активен и переходом не считается.
  const chatSelectionsRef = useRef(projects.chatSelections)
  useEffect(() => {
    if (chatSelectionsRef.current !== projects.chatSelections) {
      chatSelectionsRef.current = projects.chatSelections
      closePage()
    }
  }, [projects.chatSelections, closePage])

  useAppCommands({
    projects,
    toggleSidebar,
    toggleTerminal,
    toggleChanges,
    toggleFiles,
    toggleTasks,
    quickOpen,
    openSettings,
    toggleRepository,
    toggleAgents
  })
  useChatsCovered(page !== null || settingsSection !== null)

  return (
    <CanvasNavigationProvider navigation={canvasNavigation}>
      <div className="app" data-sidebar={sidebarVisible ? 'visible' : 'hidden'}>
        {sidebarVisible && (
          <Sidebar
            repositoryOpen={page?.kind === 'repository'}
            agentsOpen={page?.kind === 'agents'}
            boardOpen={page?.kind === 'board'}
            canvasListOpen={page?.kind === 'canvasList'}
            onOpenSettings={openSettings}
            onToggleSidebar={toggleSidebar}
            onToggleRepository={toggleRepository}
            onToggleAgents={toggleAgents}
            onToggleBoard={toggleBoard}
            onToggleCanvasList={toggleCanvasList}
            onOpenRepository={openRepository}
          />
        )}
        <Workspace
          page={page}
          repositorySection={repositorySection}
          onRepositorySectionChange={setRepositorySection}
          onClosePage={closePage}
          onOpenChat={openChat}
          terminals={terminals}
          sidePanel={sidePanel}
          quickOpenRequest={quickOpenRequest}
          onToggleTerminal={toggleTerminal}
          onToggleChanges={toggleChanges}
          onToggleFiles={toggleFiles}
          onToggleTasks={toggleTasks}
          onShowTasks={showTasks}
        />
        {/*
          Закрытому сайдбару остаётся одна таблетка. Она стоит после рабочей области намеренно: шапка
          рабочей области — зона перетаскивания окна на всю ширину, и зона кнопки «не перетаскивать»
          работает над ней, только если идёт позже в разметке.
        */}
        {!sidebarVisible && <WindowPill sidebarVisible={false} onToggleSidebar={toggleSidebar} />}
      </div>
      {settingsSection && <SettingsView initialSection={settingsSection} onClose={closeSettings} />}
    </CanvasNavigationProvider>
  )
}
