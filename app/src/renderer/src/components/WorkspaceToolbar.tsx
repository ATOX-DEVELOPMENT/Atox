import { FileDiff, SquareTerminal } from 'lucide-react'
import { ToolbarButton } from './ToolbarButton'

interface WorkspaceToolbarProps {
  terminalOpen: boolean
  changesOpen: boolean
  /** Без выбранного проекта терминалу и изменениям негде открыться. */
  projectAvailable: boolean
  onToggleTerminal(): void
  onToggleChanges(): void
}

/** Кнопки в правом верхнем углу рабочей области, как в Claude. */
export function WorkspaceToolbar({
  terminalOpen,
  changesOpen,
  projectAvailable,
  onToggleTerminal,
  onToggleChanges
}: WorkspaceToolbarProps) {
  return (
    <div className="workspace-toolbar">
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
