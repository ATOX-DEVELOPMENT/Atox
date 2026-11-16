/**
 * Раскладка экранов на холсте: каждая запись — ряд по смыслу в рамке-группе с названием (`ids` — id
 * состояний слева направо), ряды идут сверху вниз. Состояние, которого здесь нет, попадает в последний ряд: новое состояние не пропадает,
 * но его стоит добавить в нужный ряд.
 */
export const rows = [
  { name: 'Chat: conversation', ids: ['chat', 'chat-answer', 'chat-working', 'chat-approval', 'chat-approval-allowed', 'chat-approval-denied', 'chat-question', 'chat-question-answered'] },
  { name: 'Chat: states and limits', ids: ['chat-compaction', 'chat-error', 'chat-context', 'chat-limits', 'chat-agent-switch', 'chat-attachments', 'chat-queued', 'chat-split'] },
  { name: 'Empty states', ids: ['chat-empty', 'chat-empty-workspace', 'chat-space-work', 'settings-agents', 'workspace-canvas-empty', 'workspace-board-empty', 'workspace-repo-not-git'] },
  { name: 'Composer', ids: ['chat-composer-typed', 'chat-composer-attachment', 'chat-model-picker', 'chat-model-picker-effort', 'chat-slash-menu', 'chat-slash-filtered'] },
  { name: 'Sidebar', ids: ['chat-sidebar-workers', 'chat-sidebar-icons', 'chat-sidebar-hidden', 'chat-chat-menu', 'chat-project-menu', 'chat-project-color', 'chat-project-move', 'chat-icon-picker', 'chat-project-rename', 'chat-space-menu', 'settings-plan-limits'] },
  { name: 'Settings: appearance and usage', ids: ['settings-general', 'settings-general-light', 'settings-general-rose', 'settings-usage', 'settings-update-unsupported'] },
  { name: 'Settings: sections', ids: ['settings-archive', 'chat-archived', 'settings-github', 'settings-plugins', 'settings-skills', 'settings-mcp', 'settings-shortcuts', 'settings-shortcut-recording'] },
  { name: 'Canvases', ids: ['workspace-canvas-list', 'workspace-canvas-archived', 'workspace-canvas-search', 'workspace-canvas-card-menu', 'workspace-canvas-page', 'workspace-canvas-screen-menu', 'workspace-canvas-fix', 'workspace-canvas-history'] },
  { name: 'Board', ids: ['workspace-board', 'workspace-board-card-menu', 'workspace-board-start', 'workspace-board-repositories'] },
  { name: 'Repository', ids: ['workspace-repo-pulls', 'workspace-repo-pulls-closed', 'workspace-repo-issues', 'workspace-repo-filter'] },
  { name: 'Terminal and changes', ids: ['workspace-terminal', 'workspace-changes'] }
]
