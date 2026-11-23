import { Activity, FileDiff, FolderTree, SquareTerminal } from 'lucide-react'
import { ToolbarButton } from './ToolbarButton'

interface WorkspaceToolbarProps {
  terminalOpen: boolean
  changesOpen: boolean
  filesOpen: boolean
  tasksOpen: boolean
  /** Сколько фоновых задач идёт у текущего чата. */
  taskCount: number
  /** Без выбранного проекта терминалу и изменениям негде открыться. */
  projectAvailable: boolean
  onToggleTerminal(): void
  onToggleChanges(): void
  onToggleFiles(): void
  onToggleTasks(): void
}

/** Кнопки в правом верхнем углу рабочей области, как в Claude. */
export function WorkspaceToolbar({
  terminalOpen,
  changesOpen,
  filesOpen,
  tasksOpen,
  taskCount,
  projectAvailable,
  onToggleTerminal,
  onToggleChanges,
  onToggleFiles,
  onToggleTasks
}: WorkspaceToolbarProps) {
  return (
    <div className="workspace-toolbar">
      <ToolbarButton
        icon={Activity}
        shortcut="toggleTasks"
        label={
          taskCount > 0
            ? `Background tasks: ${taskCount} running`
            : tasksOpen
              ? 'Hide background tasks'
              : 'Show background tasks'
        }
        active={tasksOpen}
        badge={taskCount > 0 ? taskCount : undefined}
        disabled={!projectAvailable}
        onClick={onToggleTasks}
      />
      <ToolbarButton
        icon={FolderTree}
        shortcut="toggleFiles"
        label={filesOpen ? 'Hide files' : 'Show files'}
        active={filesOpen}
        disabled={!projectAvailable}
        onClick={onToggleFiles}
      />
      <ToolbarButton
        icon={FileDiff}
        shortcut="toggleChanges"
        label={changesOpen ? 'Hide changes' : 'Show changes'}
        active={changesOpen}
        disabled={!projectAvailable}
        onClick={onToggleChanges}
      />
      <ToolbarButton
        icon={SquareTerminal}
        shortcut="toggleTerminal"
        label={terminalOpen ? 'Hide terminal' : 'Open terminal'}
        active={terminalOpen}
        disabled={!projectAvailable}
        onClick={onToggleTerminal}
      />
    </div>
  )
}
