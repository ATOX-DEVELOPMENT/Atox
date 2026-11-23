import { useRef, useState, type CSSProperties } from 'react'
import { X } from 'lucide-react'
import { DEFAULT_SPLIT_POSITION } from '../../../shared/split'
import { useProjectsContext } from '../hooks/ProjectsContext'
import { useGitBranches } from '../hooks/useGitBranches'
import type { TerminalPanelState } from '../hooks/useTerminalPanel'
import { AgentsView } from './AgentsView'
import { BoardView } from './BoardView'
import { CanvasList } from './canvas/CanvasList'
import { CanvasPage } from './canvas/CanvasPage'
import { ChangesPanel } from './ChangesPanel'
import { FilesPanel } from './FilesPanel'
import { TasksPanel } from './TasksPanel'
import { useBackgroundTasks } from '../hooks/BackgroundTasksContext'
import { ChatView } from './ChatView'
import { RepositoryView, type RepositorySection } from './RepositoryView'
import { SplitResizer } from './SplitResizer'
import { TerminalPanel } from './TerminalPanel'
import { Welcome } from './Welcome'
import { WorkspaceTitle } from './WorkspaceTitle'
import { WorkspaceToolbar } from './WorkspaceToolbar'

/** Панель справа от чатов, на месте терминала. */
export type SidePanel = 'changes' | 'files' | 'tasks'

/** Страница, открытая поверх чатов. */
export type WorkspacePage =
  | { kind: 'agents' }
  | { kind: 'board' }
  | { kind: 'repository'; projectId: string }
  | { kind: 'canvasList' }
  | { kind: 'canvas'; canvasId: string }

interface WorkspaceProps {
  page: WorkspacePage | null
  repositorySection: RepositorySection
  onRepositorySectionChange(section: RepositorySection): void
  onClosePage(): void
  onOpenChat(chatId: string): void
  terminals: TerminalPanelState
  /** Панель, открытая вместо терминала. */
  sidePanel: SidePanel | null
  /** Растёт с каждым ⌘P: панель файлов открывает поиск файла. */
  quickOpenRequest: number
  onToggleTerminal(): void
  onToggleChanges(): void
  onToggleFiles(): void
  onToggleTasks(): void
  /** Открывает фоновые задачи текущего чата — по таблетке у поля ввода. */
  onShowTasks(): void
}

export function Workspace({
  page,
  repositorySection,
  onRepositorySectionChange,
  onClosePage,
  onOpenChat,
  terminals,
  sidePanel,
  quickOpenRequest,
  onToggleTerminal,
  onToggleChanges,
  onToggleFiles,
  onToggleTasks,
  onShowTasks
}: WorkspaceProps) {
  const {
    projects,
    activeChatId,
    visibleChatIds,
    openedChatIds,
    currentProjectId,
    selectChat,
    closeChatPane,
    setSplitPosition
  } = useProjectsContext()
  const branches = useGitBranches()
  const chatsRef = useRef<HTMLDivElement>(null)
  // Пока тянут разделитель, положение живёт здесь; у проекта сохраняется только итоговое.
  const [draftPosition, setDraftPosition] = useState<number | null>(null)
  const currentProject = projects.find(({ id }) => id === currentProjectId)
  const splitPosition = draftPosition ?? currentProject?.split?.position ?? DEFAULT_SPLIT_POSITION
  // Проект страницы репозитория могли убрать из списка — тогда и страницы нет.
  const repositoryProject =
    page?.kind === 'repository' ? projects.find(({ id }) => id === page.projectId) : undefined
  const pageOpen =
    page?.kind === 'agents' ||
    page?.kind === 'board' ||
    page?.kind === 'canvasList' ||
    page?.kind === 'canvas' ||
    Boolean(repositoryProject)
  const isSplit = !pageOpen && visibleChatIds.length > 1
  // Терминалы убранных проектов main-процесс уже остановил.
  const terminalProjectIds = terminals.attachedProjectIds.filter((id) =>
    projects.some((project) => project.id === id)
  )
  const shownPanel = currentProjectId ? sidePanel : null
  const terminalOpen =
    !shownPanel &&
    Boolean(currentProjectId && terminals.openProjectIds.includes(currentProjectId))
  // Чат вместе с папкой его проекта: чату нужны только они, а не весь список проектов.
  const chatEntries = new Map(
    projects.flatMap((project) =>
      project.chats.map((chat) => [chat.id, { chat, projectPath: project.path }] as const)
    )
  )
  // Смонтированы недавно открытые и видимые чаты. Порядок — как в проектах, а не по свежести:
  // иначе каждое переключение переставляло бы панели в DOM.
  const mountedChatIds = [...chatEntries.keys()].filter(
    (chatId) => openedChatIds.includes(chatId) || visibleChatIds.includes(chatId)
  )
  const activeTasks = useBackgroundTasks(activeChatId)
  const activeChatProject = activeChatId
    ? projects.find((project) => project.chats.some((chat) => chat.id === activeChatId))
    : undefined

  return (
    <main className="workspace">
      <div className="workspace__main">
        <header className="workspace__header">
          {/* У страниц поверх чатов свои заголовки. */}
          {!pageOpen && activeChatId && activeChatProject && (
            <WorkspaceTitle
              chatTitle={chatEntries.get(activeChatId)?.chat.title ?? ''}
              projectName={activeChatProject.name}
            />
          )}
          {/* Кнопки панелей относятся к чату: на страницах настроек, репозитория и агентов их нет. */}
          {!pageOpen && (
            <WorkspaceToolbar
              terminalOpen={terminalOpen}
              changesOpen={shownPanel === 'changes'}
              filesOpen={shownPanel === 'files'}
              tasksOpen={shownPanel === 'tasks'}
              taskCount={activeTasks.length}
              projectAvailable={Boolean(currentProjectId)}
              onToggleTerminal={onToggleTerminal}
              onToggleChanges={onToggleChanges}
              onToggleFiles={onToggleFiles}
              onToggleTasks={onToggleTasks}
            />
          )}
        </header>
        <div
          ref={chatsRef}
          className="workspace__chats"
          data-split={isSplit}
          style={{ '--split-position': `${splitPosition * 100}%` } as CSSProperties}
        >
          {mountedChatIds.map((chatId) => {
            const pane = visibleChatIds.indexOf(chatId)
            const visible = !pageOpen && pane >= 0
            const focused = visible && chatId === activeChatId
            return (
              // Недавние чаты остаются смонтированными: возврат в них не перезагружает ленту.
              <section
                key={chatId}
                className="chat-pane"
                data-pane={pane}
                data-focused={focused}
                hidden={!visible}
                onFocus={() => selectChat(chatId)}
              >
                {isSplit && (
                  <header className="chat-pane__header">
                    <span className="chat-pane__title">{chatEntries.get(chatId)?.chat.title}</span>
                    <button
                      type="button"
                      className="chat-pane__close"
                      aria-label="Close"
                      title="Close"
                      onClick={() => closeChatPane(chatId)}
                    >
                      <X className="icon" />
                    </button>
                  </header>
                )}
                <ChatView
                  chat={chatEntries.get(chatId)!.chat}
                  projectPath={chatEntries.get(chatId)!.projectPath}
                  visible={visible}
                  focused={focused}
                  onShowTasks={onShowTasks}
                />
              </section>
            )
          })}
          {isSplit && currentProjectId && (
            <SplitResizer
              position={splitPosition}
              containerRef={chatsRef}
              onDrag={setDraftPosition}
              onCommit={(position) => setSplitPosition(currentProjectId, position)}
            />
          )}
          {!pageOpen && !activeChatId && (
            <div className="workspace__empty">
              <Welcome />
            </div>
          )}
        </div>
      </div>
      {!pageOpen && shownPanel === 'changes' && currentProjectId && (
        <ChangesPanel projectId={currentProjectId} />
      )}
      {!pageOpen && shownPanel === 'tasks' && currentProjectId && (
        <TasksPanel tasks={activeTasks} />
      )}
      {!pageOpen && shownPanel === 'files' && currentProjectId && (
        <FilesPanel
          // Открытый файл и раскрытые папки у каждого проекта свои.
          key={currentProjectId}
          projectId={currentProjectId}
          quickOpenRequest={quickOpenRequest}
        />
      )}
      <TerminalPanel
        projectIds={terminalProjectIds}
        shownProjectId={!pageOpen && terminalOpen ? currentProjectId : null}
        focusRequest={terminals.focusRequest}
        onClose={terminals.close}
      />
      {page?.kind === 'agents' && <AgentsView onOpenChat={onOpenChat} onClose={onClosePage} />}
      {page?.kind === 'board' && <BoardView onOpenChat={onOpenChat} onClose={onClosePage} />}
      {page?.kind === 'canvasList' && <CanvasList onClose={onClosePage} />}
      {page?.kind === 'canvas' && (
        <CanvasPage
          // Вид, выбор и окно «Fix» у каждого холста свои: другой холст начинается заново.
          key={page.canvasId}
          canvasId={page.canvasId}
          onClose={onClosePage}
        />
      )}
      {repositoryProject && (
        <RepositoryView
          // У каждого проекта свои фильтры и данные: при смене проекта страница начинается заново.
          key={repositoryProject.id}
          project={repositoryProject}
          branch={branches[repositoryProject.path] ?? null}
          section={repositorySection}
          onSectionChange={onRepositorySectionChange}
          onClose={onClosePage}
        />
      )}
    </main>
  )
}
