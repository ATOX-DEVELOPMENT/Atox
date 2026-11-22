import { useState } from 'react'
import {
  Bot,
  FolderPlus,
  GitPullRequest,
  LayoutDashboard,
  SquareKanban,
  SquarePen
} from 'lucide-react'
import { useCanvases } from '../hooks/CanvasesContext'
import { useProjectsContext } from '../hooks/ProjectsContext'
import { useGitBranches } from '../hooks/useGitBranches'
import { useSettings } from '../hooks/SettingsContext'
import { NO_CHAT_IDS } from '../lib/chatLayout'
import { ProfileBar } from './ProfileBar'
import { ProjectItem } from './ProjectItem'
import type { Project } from '../../../shared/models'
import { SIDEBAR_WIDTH } from '../../../shared/settings'
import { PanelResizer } from './PanelResizer'
import type { SettingsSection } from './SettingsView'
import { SidebarButton } from './SidebarButton'
import { SortableList } from './SortableList'
import { SpacePicker } from './SpacePicker'

function containsChat(project: Project, chatId: string | null): boolean {
  return chatId !== null && project.chats.some(({ id }) => id === chatId)
}

interface SidebarProps {
  /** Открыта страница репозитория — её кнопка подсвечена. */
  repositoryOpen: boolean
  /** Открыт обзор агентов. */
  agentsOpen: boolean
  /** Открыта доска задач. */
  boardOpen: boolean
  /** Открыт список холстов. */
  canvasListOpen: boolean
  onOpenSettings(section?: SettingsSection): void
  onToggleRepository(): void
  onToggleAgents(): void
  onToggleBoard(): void
  onToggleCanvasList(): void
  onOpenRepository(projectId: string): void
}

export function Sidebar({
  repositoryOpen,
  agentsOpen,
  boardOpen,
  canvasListOpen,
  onOpenSettings,
  onToggleRepository,
  onToggleAgents,
  onToggleBoard,
  onToggleCanvasList,
  onOpenRepository
}: SidebarProps) {
  const {
    loading,
    spaces,
    spaceProjects,
    activeChatId,
    visibleChatIds,
    currentProjectId,
    addProject,
    moveProject,
    createChat
  } = useProjectsContext()
  const { sidebarWidth, sidebarButtons } = useSettings()
  const branches = useGitBranches()
  const canvases = useCanvases()
  // Холсты в архиве не считаются: их нет и в списке чатов.
  const canvasCount = canvases
    ? new Set(canvases.filter(({ archived }) => !archived).map(({ chatId }) => chatId)).size
    : undefined
  // Пока тянут край, ширина живёт здесь; в настройки попадает только итоговая.
  const [draftWidth, setDraftWidth] = useState<number | null>(null)
  const width = draftWidth ?? sidebarWidth

  return (
    <aside className="sidebar" style={{ width }}>
      <div className="sidebar__titlebar" />

      <nav className="sidebar__nav" data-style={sidebarButtons}>
        <SidebarButton
          icon={SquarePen}
          label="New chat"
          disabled={!currentProjectId}
          onClick={() => currentProjectId && void createChat(currentProjectId)}
        />
        <SidebarButton icon={FolderPlus} label="New project" onClick={() => void addProject()} />
        <SidebarButton
          icon={GitPullRequest}
          label="Repository"
          active={repositoryOpen}
          disabled={!currentProjectId}
          onClick={onToggleRepository}
        />
        <SidebarButton icon={Bot} label="Agents" active={agentsOpen} onClick={onToggleAgents} />
        <SidebarButton
          icon={SquareKanban}
          label="Board"
          active={boardOpen}
          onClick={onToggleBoard}
        />
        <SidebarButton
          icon={LayoutDashboard}
          label="Canvases"
          count={canvasCount}
          active={canvasListOpen}
          onClick={onToggleCanvasList}
        />
      </nav>

      <div className="sidebar__spaces">
        <SpacePicker />
      </div>

      <section className="sidebar__section">
        {/* Пока проекты загружаются, пустое состояние не показываем — оно бы мигнуло. */}
        {!loading && spaceProjects.length === 0 ? (
          <p className="sidebar__empty">No projects yet</p>
        ) : (
          <SortableList
            items={spaceProjects}
            onMove={(id, toIndex) => void moveProject(id, toIndex)}
          >
            {(project) => (
              <ProjectItem
                key={project.id}
                project={project}
                branch={branches[project.path] ?? null}
                onOpenRepository={onOpenRepository}
                spaces={spaces}
                // Выбор чата передаётся только его проекту: остальные карточки не перерисовываются.
                activeChatId={containsChat(project, activeChatId) ? activeChatId : null}
                visibleChatIds={
                  visibleChatIds.some((id) => containsChat(project, id))
                    ? visibleChatIds
                    : NO_CHAT_IDS
                }
              />
            )}
          </SortableList>
        )}
      </section>

      <ProfileBar onOpenSettings={onOpenSettings} />

      <PanelResizer
        width={width}
        bounds={SIDEBAR_WIDTH}
        edge="right"
        label="Resize sidebar"
        onDrag={setDraftWidth}
        onCommit={(next) => window.atox.settings.update({ sidebarWidth: next })}
      />
    </aside>
  )
}
