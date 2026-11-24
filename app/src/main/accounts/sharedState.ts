import {
  copyFile,
  lstat,
  mkdir,
  readdir,
  readFile,
  readlink,
  rename,
  rm,
  rmdir,
  symlink,
  unlink,
  writeFile
} from 'node:fs/promises'
import { homedir } from 'node:os'
import { dirname, join, resolve } from 'node:path'
import type { AgentId } from '../../shared/agents'

/** Что из папки основного аккаунта видно и в папке дополнительного. */
interface SharedEntry {
  name: string
  kind: 'directory' | 'file'
  /**
   * Создать в основной папке, если её там нет. Нужно тому, что должно быть общим с первого
   * же сообщения: иначе агент создаст свою папку в аккаунте, и история чатов разойдётся.
   */
  create?: boolean
}

/**
 * Состояние Claude Code, общее для всех аккаунтов: история чатов, настройки, навыки, плагины,
 * команды и сабагенты. Всё остальное — вход, кэши, счётчики — у каждого аккаунта своё.
 * Папки связываются ссылками: копий и лишнего места на диске нет, а чат виден из любого
 * аккаунта и из обычного `claude` в терминале.
 */
const CLAUDE_SHARED: readonly SharedEntry[] = [
  { name: 'projects', kind: 'directory', create: true },
  { name: 'skills', kind: 'directory', create: true },
  { name: 'plugins', kind: 'directory', create: true },
  { name: 'commands', kind: 'directory' },
  { name: 'agents', kind: 'directory' },
  { name: 'hooks', kind: 'directory' },
  { name: 'rules', kind: 'directory' },
  { name: 'output-styles', kind: 'directory' },
  { name: 'plans', kind: 'directory' },
  { name: 'todos', kind: 'directory' },
  { name: 'file-history', kind: 'directory' },
  { name: 'settings.json', kind: 'file' },
  { name: 'settings.local.json', kind: 'file' },
  { name: 'CLAUDE.md', kind: 'file' }
]

/**
 * То же для Codex. Разговоры лежат в `sessions`, а по ним Codex находит и продолжает тред
 * сам — отдельная база ему для этого не нужна.
 */
const CODEX_SHARED: readonly SharedEntry[] = [
  { name: 'sessions', kind: 'directory', create: true },
  { name: 'archived_sessions', kind: 'directory', create: true },
  { name: 'skills', kind: 'directory' },
  { name: 'plugins', kind: 'directory' },
  { name: 'rules', kind: 'directory' },
  { name: 'prompts', kind: 'directory' },
  { name: 'config.toml', kind: 'file' },
  { name: 'AGENTS.md', kind: 'file' },
  { name: 'session_index.jsonl', kind: 'file' }
]

/** Общее состояние агента: где оно лежит у основного аккаунта и что из него видно остальным. */
interface SharedState {
  /** Папка основного аккаунта. */
  home: string
  entries: readonly SharedEntry[]
}

/** Откуда агент берёт свою папку: переменная окружения, если задана, иначе папка в `~`. */
export function agentHome(agent: AgentId, environment: Record<string, string>): string {
  const variable = agent === 'claude' ? 'CLAUDE_CONFIG_DIR' : 'CODEX_HOME'
  return environment[variable] || join(homedir(), agent === 'claude' ? '.claude' : '.codex')
}

/** Переменная окружения, которой агенту указывают папку аккаунта. */
export function homeVariable(agent: AgentId): 'CLAUDE_CONFIG_DIR' | 'CODEX_HOME' {
  return agent === 'claude' ? 'CLAUDE_CONFIG_DIR' : 'CODEX_HOME'
}

function sharedState(agent: AgentId, environment: Record<string, string>): SharedState {
  return {
    home: agentHome(agent, environment),
    entries: agent === 'claude' ? CLAUDE_SHARED : CODEX_SHARED
  }
}

/**
 * Готовит папку дополнительного аккаунта: создаёт её и связывает общее состояние с папкой
 * основного. Безопасно вызывать перед каждым запуском агента: что уже связано, не трогается,
 * а появившееся в основной папке позже подключается.
 */
export async function prepareAccountDirectory(
  agent: AgentId,
  directory: string,
  environment: Record<string, string>
): Promise<void> {
  const { home, entries } = sharedState(agent, environment)
  await mkdir(directory, { recursive: true })
  // Ссылка на самого себя замкнула бы папку в кольцо: основной аккаунт не может быть дополнительным.
  if (resolve(home) === resolve(directory)) {
    throw new Error('The account directory must not be the main agent directory.')
  }
  for (const entry of entries) {
    const target = join(home, entry.name)
    if (entry.create && entry.kind === 'directory') {
      await mkdir(target, { recursive: true })
    }
    if (!(await exists(target))) {
      continue
    }
    await link(target, join(directory, entry.name), entry.kind)
  }
  if (agent === 'claude') {
    await syncClaudeConfig(claudeConfigFile(home, environment), join(directory, '.claude.json'))
  }
}

/**
 * Удаляет папку дополнительного аккаунта. Сначала снимаются ссылки на общее состояние:
 * рекурсивное удаление по ним дошло бы до истории чатов основного аккаунта.
 */
export async function removeAccountDirectory(directory: string): Promise<void> {
  let names: string[]
  try {
    names = await readdir(directory)
  } catch (error) {
    if (isMissing(error)) {
      return
    }
    throw error
  }
  for (const name of names) {
    const path = join(directory, name)
    if ((await lstat(path)).isSymbolicLink()) {
      await unlink(path)
    }
  }
  await rm(directory, { recursive: true, force: true })
}

/**
 * Делает `path` ссылкой на `target`. Настоящую папку или файл, в которых уже что-то есть,
 * не трогает: данные аккаунта дороже общего вида — они остаются как есть.
 */
async function link(target: string, path: string, kind: SharedEntry['kind']): Promise<void> {
  const existing = await lstat(path).catch((error: unknown) => {
    if (isMissing(error)) {
      return null
    }
    throw error
  })
  if (existing?.isSymbolicLink()) {
    if (resolve(dirname(path), await readlink(path)) === resolve(target)) {
      return
    }
    await unlink(path)
  } else if (existing) {
    // Пустую папку, которую агент успел создать сам, заменяем ссылкой; с данными — оставляем.
    if (existing.isDirectory() && (await readdir(path)).length === 0) {
      await rmdir(path)
    } else {
      console.warn(`Account entry ${path} already exists and is not shared with ${target}`)
      return
    }
  }
  try {
    // На Windows ссылка на папку — junction: она не требует прав администратора.
    await symlink(target, path, kind === 'directory' ? 'junction' : 'file')
  } catch (error) {
    // Ссылку на файл на Windows может создавать только администратор: тогда копируем файл.
    if (kind === 'file' && ['EPERM', 'EACCES'].includes((error as NodeJS.ErrnoException).code ?? '')) {
      await copyFile(target, path)
      return
    }
    throw error
  }
}

async function exists(path: string): Promise<boolean> {
  return lstat(path).then(
    () => true,
    (error: unknown) => {
      if (isMissing(error)) {
        return false
      }
      throw error
    }
  )
}

function isMissing(error: unknown): boolean {
  return (error as NodeJS.ErrnoException).code === 'ENOENT'
}

/** Где Claude Code основного аккаунта хранит `.claude.json`: рядом с папкой или в `~`. */
function claudeConfigFile(home: string, environment: Record<string, string>): string {
  return environment['CLAUDE_CONFIG_DIR'] ? join(home, '.claude.json') : join(homedir(), '.claude.json')
}

/**
 * Поля `.claude.json`, которые аккаунту нужны так же, как основному. Остальное — вход
 * (`oauthAccount`, `userID`), кэши подписки и флагов, счётчики и подсказки — принадлежит
 * самому аккаунту и не копируется.
 */
const SHARED_FLAGS = ['hasCompletedOnboarding', 'lastOnboardingVersion', 'theme', 'installMethod']

type Json = Record<string, unknown>

function isRecord(value: unknown): value is Json {
  return typeof value === 'object' && value !== null && !Array.isArray(value)
}

/**
 * Дополняет `.claude.json` аккаунта тем, что есть у основного: серверами MCP, папками проектов
 * (с их доверием — чтобы агент не спрашивал о нём заново) и признаком пройденного знакомства.
 * Уже записанное в аккаунте не меняется; доверие к папке только добавляется.
 * Возвращает `null`, если дополнять нечего.
 */
export function mergeClaudeConfig(main: unknown, account: unknown): Json | null {
  if (!isRecord(main)) {
    return null
  }
  const merged: Json = isRecord(account) ? { ...account } : {}
  let changed = false
  const set = (key: string, value: unknown): void => {
    merged[key] = value
    changed = true
  }
  for (const flag of SHARED_FLAGS) {
    if (main[flag] !== undefined && merged[flag] === undefined) {
      set(flag, main[flag])
    }
  }
  for (const key of ['mcpServers', 'githubRepoPaths']) {
    const source = main[key]
    if (!isRecord(source)) {
      continue
    }
    const current = merged[key]
    const own = isRecord(current) ? { ...current } : {}
    let added = false
    for (const [name, value] of Object.entries(source)) {
      if (!(name in own)) {
        own[name] = value
        added = true
      }
    }
    if (added) {
      set(key, own)
    }
  }
  const mainProjects = main['projects']
  if (isRecord(mainProjects)) {
    const current = merged['projects']
    const own = isRecord(current) ? { ...current } : {}
    let added = false
    for (const [path, project] of Object.entries(mainProjects)) {
      const current = own[path]
      if (current === undefined) {
        own[path] = project
        added = true
      } else if (
        isRecord(current) &&
        isRecord(project) &&
        project['hasTrustDialogAccepted'] === true &&
        current['hasTrustDialogAccepted'] !== true
      ) {
        own[path] = { ...current, hasTrustDialogAccepted: true }
        added = true
      }
    }
    if (added) {
      set('projects', own)
    }
  }
  return changed ? merged : null
}

/** Переносит нужные поля из `.claude.json` основного аккаунта в `.claude.json` дополнительного. */
async function syncClaudeConfig(mainFile: string, accountFile: string): Promise<void> {
  const main = await readJson(mainFile)
  if (main === undefined) {
    return
  }
  const account = await readJson(accountFile)
  // Файл, который Claude Code сейчас пишет, читается недописанным: пропускаем этот запуск,
  // а не затираем его — всё подтянется при следующем.
  if (account === null) {
    return
  }
  const merged = mergeClaudeConfig(main, account)
  if (!merged) {
    return
  }
  // Запись через временный файл: Claude Code не увидит наполовину записанный файл.
  const temporary = `${accountFile}.atox-${process.pid}.tmp`
  await writeFile(temporary, `${JSON.stringify(merged, null, 2)}\n`, { mode: 0o600 })
  await rename(temporary, accountFile)
}

/** `undefined` — файла нет, `null` — его не удалось прочитать как JSON. */
async function readJson(file: string): Promise<unknown> {
  let raw: string
  try {
    raw = await readFile(file, 'utf-8')
  } catch (error) {
    if (isMissing(error)) {
      return undefined
    }
    throw error
  }
  try {
    return JSON.parse(raw)
  } catch {
    return null
  }
}
