import { Bot, Eye, LoaderCircle, Terminal, Workflow, type LucideIcon } from 'lucide-react'
import type { BackgroundTask, BackgroundTaskKind } from '../../../shared/conversation'

export const BACKGROUND_TASK_ICONS: Record<BackgroundTaskKind, LucideIcon> = {
  shell: Terminal,
  agent: Bot,
  monitor: Eye,
  workflow: Workflow,
  other: LoaderCircle
}

export const BACKGROUND_TASK_LABELS: Record<BackgroundTaskKind, string> = {
  shell: 'Command',
  agent: 'Agent',
  monitor: 'Watching',
  workflow: 'Workflow',
  other: 'Task'
}

interface BackgroundTasksPillProps {
  tasks: readonly BackgroundTask[]
  onClick(): void
}

/**
 * Таблетка в строке поля ввода: агент оставил работу в фоне. Список — в панели справа, по
 * клику; здесь только знак, что работа идёт.
 */
export function BackgroundTasksPill({ tasks, onClick }: BackgroundTasksPillProps) {
  const label = tasks.length === 1 ? '1 task' : `${tasks.length} tasks`
  const hint = tasks.map(({ description }) => description).join('\n')
  return (
    <button
      type="button"
      className="background-pill"
      aria-label={`${label} running in the background`}
      title={hint}
      onClick={onClick}
    >
      <LoaderCircle className="background-pill__spinner" aria-hidden />
      {label}
    </button>
  )
}
