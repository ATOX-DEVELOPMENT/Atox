/**
 * Раскладка экранов на холсте: каждая строка — ряд по смыслу (id состояний слева направо), ряды идут
 * сверху вниз. Состояние, которого здесь нет, попадает в последний ряд: новое состояние не пропадает,
 * но его стоит добавить в нужный ряд.
 */
export const rows = [
  // Чат
  ['chat', 'chat-answer', 'chat-working', 'chat-approval', 'chat-approval-allowed', 'chat-approval-denied', 'chat-question', 'chat-question-answered'],
  ['chat-compaction', 'chat-error', 'chat-context', 'chat-limits', 'chat-agent-switch', 'chat-attachments', 'chat-queued', 'chat-split'],
  // Пустые состояния
  ['chat-empty', 'chat-empty-workspace', 'chat-space-work', 'settings-agents', 'workspace-canvas-empty', 'workspace-board-empty', 'workspace-repo-not-git'],
  // Поле ввода
  ['chat-composer-typed', 'chat-composer-attachment', 'chat-model-picker', 'chat-model-picker-effort', 'chat-slash-menu', 'chat-slash-filtered'],
  // Сайдбар
  ['chat-sidebar-workers', 'chat-sidebar-icons', 'chat-sidebar-hidden', 'chat-chat-menu', 'chat-project-menu', 'chat-project-color', 'chat-project-move', 'chat-icon-picker', 'chat-project-rename', 'chat-space-menu', 'settings-plan-limits'],
  // Настройки
  ['settings-general', 'settings-general-light', 'settings-general-rose', 'settings-usage', 'settings-update-unsupported'],
  ['settings-archive', 'chat-archived', 'settings-github', 'settings-plugins', 'settings-skills', 'settings-mcp', 'settings-shortcuts', 'settings-shortcut-recording'],
  // Холсты
  ['workspace-canvas-list', 'workspace-canvas-archived', 'workspace-canvas-search', 'workspace-canvas-card-menu', 'workspace-canvas-page', 'workspace-canvas-screen-menu', 'workspace-canvas-fix', 'workspace-canvas-history'],
  // Доска
  ['workspace-board', 'workspace-board-card-menu', 'workspace-board-start', 'workspace-board-repositories'],
  // Репозиторий
  ['workspace-repo-pulls', 'workspace-repo-pulls-closed', 'workspace-repo-issues', 'workspace-repo-filter'],
  // Терминал и изменения
  ['workspace-terminal', 'workspace-changes']
]
