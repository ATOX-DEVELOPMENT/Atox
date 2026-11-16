/**
 * Проекты и чаты демо-профиля. У проектов с `repository` в `/tmp/atox-demo/<имя>` создаётся
 * настоящий git-репозиторий (для страницы изменений); остальные получают пустую папку.
 */
export const SPACES = [
  { id: 'space-main', name: 'Main', color: 'orange', lastChatId: 'c-fern-checkout' },
  { id: 'space-work', name: 'Work', color: 'green' }
]

const base = Date.UTC(2026, 10, 16, 9, 0, 0)
const chat = (id, title, minutes, extra = {}) => ({
  id,
  title,
  agent: 'claude',
  createdAt: base + minutes * 60_000,
  model: 'sonnet',
  effort: 'medium',
  hasCustomTitle: true,
  ...extra
})

export const PROJECTS = [
  {
    id: 'p-fern',
    name: 'Fern',
    spaceId: 'space-main',
    icon: 'leaf',
    repository: true,
    chats: [
      chat('c-fern-checkout', 'Fix the checkout total rounding', 0),
      chat('c-fern-dark', 'Add a dark mode toggle', 40),
      chat('c-fern-empty', 'Plan the onboarding flow', 90, { agent: 'codex', model: undefined, effort: undefined })
    ]
  },
  {
    id: 'p-orbit',
    name: 'Orbit',
    spaceId: 'space-main',
    color: 'blue',
    repository: true,
    chats: [chat('c-orbit-1', 'Speed up the dashboard query', 120)]
  },
  {
    id: 'p-notes',
    name: 'Notes',
    spaceId: 'space-main',
    color: 'peach',
    chats: [chat('c-notes-1', 'Sync notes between devices', 150), chat('c-notes-2', 'Fix the search index', 160)]
  },
  {
    id: 'p-billing',
    name: 'Billing API',
    spaceId: 'space-work',
    chats: [chat('c-billing-1', 'Add webhook retries', 30)]
  }
]
