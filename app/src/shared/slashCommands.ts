import type { AgentCommand } from './conversation'

/**
 * Команды, которые Atox выполняет сам, а не пишет агенту: меняют настройки чата, показывают
 * лимиты и контекст карточкой, начинают разговор заново или закрывают чат.
 */
export const LOCAL_COMMANDS: readonly AgentCommand[] = [
  { name: 'model', description: 'Choose the model for this chat', argumentHint: '[model]' },
  { name: 'effort', description: 'Choose how hard the model thinks', argumentHint: '[level]' },
  { name: 'usage', description: 'Show plan usage limits' },
  { name: 'context', description: 'Show what fills the context window' },
  { name: 'clear', description: 'Start a new conversation in this chat' },
  { name: 'exit', description: 'Close this chat' }
]

/** Другие имена команд Atox — как в Claude Code. В подсказках их нет. */
export const LOCAL_COMMAND_ALIASES: Readonly<Record<string, string>> = {
  quit: 'exit',
  reset: 'clear',
  new: 'clear'
}

/** Имена, занятые командами Atox вместе с их другими именами. */
export const RESERVED_COMMAND_NAMES: ReadonlySet<string> = new Set([
  ...LOCAL_COMMANDS.map(({ name }) => name),
  ...Object.keys(LOCAL_COMMAND_ALIASES)
])

/**
 * Своя команда пользователя: «/name» в поле ввода подставляет текст промпта, который можно
 * дописать перед отправкой.
 */
export interface PromptTemplate {
  /** Имя без «/». */
  name: string
  /** Подпись в подсказках; пусто — показывается начало промпта. */
  description: string
  prompt: string
}

/** Пределы полей: шаблоны хранятся в файле настроек. */
export const PROMPT_TEMPLATE_LIMITS = {
  nameMaxLength: 32,
  descriptionMaxLength: 120,
  promptMaxLength: 20_000,
  maxCount: 100
} as const

/** Имя команды: латиница, цифры, «-» и «_», начинается с буквы или цифры — его набирают после «/». */
const TEMPLATE_NAME = /^[a-z0-9][a-z0-9_-]*$/

/** Примеры, с которыми Atox ставится; их можно поменять и удалить. */
export const DEFAULT_PROMPT_TEMPLATES: readonly PromptTemplate[] = [
  {
    name: 'review',
    description: 'Review the current changes for bugs',
    prompt:
      'Review the uncommitted changes in this repository for bugs, edge cases and regressions. ' +
      'List each problem with the file, the line and a suggested fix. Do not edit any files.'
  },
  {
    name: 'fix-tests',
    description: 'Run the tests and fix what fails',
    prompt:
      'Run the project’s test suite. If anything fails, find the cause and fix the code ' +
      '(not the tests, unless a test itself is wrong), then run the tests again until they pass.'
  }
]

/** Имя в том виде, в каком его хранят: без «/» и пробелов по краям, в нижнем регистре. */
export function normalizeTemplateName(name: string): string {
  return name.trim().replace(/^\/+/, '').toLowerCase()
}

/**
 * Почему шаблон нельзя сохранить; `null` — можно. `others` — остальные шаблоны: имя не должно
 * повторять ни их, ни команды Atox.
 */
export function promptTemplateError(
  template: PromptTemplate,
  others: readonly PromptTemplate[]
): string | null {
  const name = normalizeTemplateName(template.name)
  if (!name) {
    return 'Enter a name for the command.'
  }
  if (name.length > PROMPT_TEMPLATE_LIMITS.nameMaxLength) {
    return `The name can be at most ${PROMPT_TEMPLATE_LIMITS.nameMaxLength} characters.`
  }
  if (!TEMPLATE_NAME.test(name)) {
    return 'Use only Latin letters, digits, “-” and “_” in the name, starting with a letter or digit.'
  }
  if (RESERVED_COMMAND_NAMES.has(name)) {
    return `/${name} is a built-in Atox command. Choose another name.`
  }
  if (others.some((other) => normalizeTemplateName(other.name) === name)) {
    return `You already have a /${name} command.`
  }
  if (!template.prompt.trim()) {
    return 'Enter the prompt the command inserts.'
  }
  if (template.prompt.length > PROMPT_TEMPLATE_LIMITS.promptMaxLength) {
    return `The prompt can be at most ${PROMPT_TEMPLATE_LIMITS.promptMaxLength.toLocaleString('en-US')} characters.`
  }
  if (template.description.length > PROMPT_TEMPLATE_LIMITS.descriptionMaxLength) {
    return `The description can be at most ${PROMPT_TEMPLATE_LIMITS.descriptionMaxLength} characters.`
  }
  return null
}

/**
 * Оставляет из сохранённого только годные шаблоны: файл настроек могли править руками. Шаблон с
 * занятым или повторяющимся именем отбрасывается, а не переименовывается.
 */
export function parsePromptTemplates(value: unknown): PromptTemplate[] {
  if (!Array.isArray(value)) {
    return []
  }
  const templates: PromptTemplate[] = []
  for (const item of value) {
    if (templates.length >= PROMPT_TEMPLATE_LIMITS.maxCount) {
      break
    }
    if (typeof item !== 'object' || item === null) {
      continue
    }
    const { name, description, prompt } = item as Record<string, unknown>
    if (typeof name !== 'string' || typeof prompt !== 'string') {
      continue
    }
    const template: PromptTemplate = {
      name: normalizeTemplateName(name),
      description: typeof description === 'string' ? description.trim() : '',
      prompt
    }
    if (promptTemplateError(template, templates) === null) {
      templates.push(template)
    }
  }
  return templates
}

/** Подпись шаблона в подсказках: описание или первая строка промпта. */
export function templateSummary(template: PromptTemplate): string {
  return template.description || template.prompt.trim().split('\n', 1)[0]
}
