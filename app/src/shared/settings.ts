import { DEFAULT_AGENT_ID, type AgentId } from './agents'
import { BOARD_AGENTS, type TaskAgent } from './board'
import type { ModelSelection } from './conversation'
import type { ShortcutOverrides } from './shortcuts'
import { DEFAULT_PROMPT_TEMPLATES, type PromptTemplate } from './slashCommands'

/** Тема окна: следовать системной или всегда светлая или тёмная. */
export const THEME_MODES = ['system', 'light', 'dark'] as const
export type ThemeMode = (typeof THEME_MODES)[number]

/**
 * Акцентные цвета интерфейса. Сами цвета — в стилях (`--color-accent` по `data-accent`): у каждого
 * два оттенка, для светлой и тёмной темы. `blue` — выбран по умолчанию.
 */
export const ACCENTS = [
  { id: 'blue', name: 'Blue' },
  { id: 'periwinkle', name: 'Periwinkle' },
  { id: 'lavender', name: 'Lavender' },
  { id: 'rose', name: 'Rose' },
  { id: 'peach', name: 'Peach' },
  { id: 'sage', name: 'Sage' },
  { id: 'mint', name: 'Mint' }
] as const
export type AccentId = (typeof ACCENTS)[number]['id']

export const DEFAULT_ACCENT: AccentId = 'blue'

export function isAccentId(value: unknown): value is AccentId {
  return ACCENTS.some(({ id }) => id === value)
}

export function isThemeMode(value: unknown): value is ThemeMode {
  return THEME_MODES.some((mode) => mode === value)
}

/**
 * Вид кнопок над списком проектов: `list` — строки с иконкой и подписью, `icons` — только
 * иконки в один ряд.
 */
export const SIDEBAR_BUTTON_STYLES = ['list', 'icons'] as const
export type SidebarButtonStyle = (typeof SIDEBAR_BUTTON_STYLES)[number]

export const DEFAULT_SIDEBAR_BUTTON_STYLE: SidebarButtonStyle = 'list'

export function isSidebarButtonStyle(value: unknown): value is SidebarButtonStyle {
  return SIDEBAR_BUTTON_STYLES.some((style) => style === value)
}

export interface Settings {
  /** Агент нового чата по ⌘N; меняется на последний выбранный. */
  defaultAgent: AgentId
  /** Последние выбранные модель и эффорт каждого агента: с ними начинается новый чат. */
  agentModels: Partial<Record<AgentId, Partial<ModelSelection>>>
  /** Ширина сайдбара в пикселях; меняется перетаскиванием его края. */
  sidebarWidth: number
  /** Ширина панели терминала в пикселях; меняется перетаскиванием её края. */
  terminalWidth: number
  /** Свои горячие клавиши вместо стандартных. */
  shortcuts: ShortcutOverrides
  /** Отправлять анонимную статистику: установки и активные дни, без данных о проектах и чатах. */
  shareUsageStats: boolean
  /**
   * Короткий звук, когда агент закончил работу или ждёт пользователя. Выключен, пока его не
   * включат: внезапный звук пугает.
   */
  playSounds: boolean
  /** Имя в профиле сайдбара, которое человек ввёл сам; пусто — имя берётся из git или macOS. */
  profileName: string
  /** Фото профиля: уже обрезанная квадратная картинка в виде data URL; пусто — буква имени. */
  profileAvatar: string
  /** Тема окна. */
  theme: ThemeMode
  /** Акцентный цвет: выделения, переключатели, кнопки. */
  accent: AccentId
  /** Вид кнопок над списком проектов: строки с подписями или ряд иконок. */
  sidebarButtons: SidebarButtonStyle
  /** Сколько агентов доски работают одновременно; остальные задачи ждут в очереди. */
  boardMaxAgents: number
  /** Агент, модель и эффорт, которые предлагаются задаче с доски по умолчанию. */
  boardAgent: TaskAgent
  /** Свои слеш-команды: «/имя» в поле ввода подставляет текст промпта. */
  promptTemplates: PromptTemplate[]
}

/** Длиннее имя в таблетке профиля не помещается. */
export const PROFILE_NAME_MAX_LENGTH = 40

/** Фото профиля хранится в настройках, поэтому его размер ограничен. */
export const PROFILE_AVATAR = {
  /** Сторона квадрата в пикселях: с запасом для экрана с высокой плотностью. */
  size: 256,
  /** Формат, в который фото сохраняется после обрезки. */
  mimeType: 'image/jpeg',
  quality: 0.9,
  maxLength: 200_000
} as const

/** Фото профиля — это data URL картинки не длиннее допустимого: файл настроек могли править руками. */
export function isProfileAvatar(value: unknown): value is string {
  return (
    typeof value === 'string' &&
    value.length <= PROFILE_AVATAR.maxLength &&
    /^data:image\/(jpeg|png|webp);base64,[A-Za-z0-9+/]+={0,2}$/.test(value)
  )
}

/** Сайдбар по умолчанию самый узкий: его можно только расширить. */
export const SIDEBAR_WIDTH = {
  default: 280,
  min: 280,
  max: 480
} as const

/** Ширина панели терминала: в узком окне её дополнительно ужимает раскладка, оставляя место чату. */
export const TERMINAL_WIDTH = {
  default: 480,
  min: 320,
  max: 1200
} as const

/** Пределы ширины панели, которую тянут за край. */
export interface WidthBounds {
  default: number
  min: number
  max: number
}

export const DEFAULT_SETTINGS: Settings = {
  defaultAgent: DEFAULT_AGENT_ID,
  agentModels: {},
  sidebarWidth: SIDEBAR_WIDTH.default,
  terminalWidth: TERMINAL_WIDTH.default,
  shortcuts: {},
  shareUsageStats: true,
  playSounds: false,
  profileName: '',
  profileAvatar: '',
  theme: 'system',
  accent: DEFAULT_ACCENT,
  sidebarButtons: DEFAULT_SIDEBAR_BUTTON_STYLE,
  boardMaxAgents: BOARD_AGENTS.default,
  boardAgent: { agent: DEFAULT_AGENT_ID },
  promptTemplates: [...DEFAULT_PROMPT_TEMPLATES]
}

/** Приводит ширину панели к целому числу пикселей в её пределах. */
export function clampWidth(width: number, bounds: WidthBounds): number {
  if (!Number.isFinite(width)) {
    return bounds.default
  }
  return Math.min(bounds.max, Math.max(bounds.min, Math.round(width)))
}
