import { constants } from 'node:fs'
import { access } from 'node:fs/promises'
import { homedir } from 'node:os'
import { delimiter, join } from 'node:path'
import { AGENTS, type AgentId } from '../shared/agents'
import { IS_WINDOWS } from '../shared/platform'
import type { ShellEnvironment } from './shellEnvironment'

/**
 * Запускают агента, которого нет, — окружение оболочки перечитывается, если оно старше этого:
 * агента могли поставить, а PATH к нему дописать в профиле уже после запуска Atox. Только при
 * запуске и не чаще: большинство не ставит всех агентов, и фоновый поиск, перечитывающий
 * оболочку из-за каждого отсутствующего, запускал бы её на каждое открытие меню.
 */
const MISSING_AGENT_REFRESH_INTERVAL_MS = 60_000

/**
 * Какие агенты установлены и где лежат их программы. Программы ищутся по PATH оболочки входа —
 * тому же, что видит пользователь в терминале. Ответ отдаётся из кеша и обновляется в фоне:
 * меню нового чата открывается без задержки, а только что установленный агент появится в нём
 * со следующего раза. Запуск агента, которого в кеше нет, ждёт нового поиска.
 */
export class AgentDetector {
  private executables: Promise<Map<AgentId, string>> | null = null
  /** Идущий поиск: просьбы во время него дожидаются его, а не запускают второй. */
  private detecting: Promise<Map<AgentId, string>> | null = null

  constructor(private readonly shell: ShellEnvironment) {}

  async list(): Promise<AgentId[]> {
    return [...(await this.known()).keys()]
  }

  /**
   * Ищет агентов заново, в перечитанном окружении оболочки: агента только что установили или
   * обновили, и PATH к нему могли дописать в профиле. Пока идёт поиск, отдаётся прежний ответ.
   */
  async redetect(): Promise<void> {
    this.executables = Promise.resolve(await findAgents(await this.shell.fresh(0)))
  }

  /** Путь к программе агента; `null` — агент не установлен. */
  async executable(agent: AgentId): Promise<string | null> {
    const path = (await this.known()).get(agent)
    if (path) {
      return path
    }
    // Агента нет в прошлом ответе — возможно, его только что поставили.
    const found = await this.startDetection()
    return found.get(agent) ?? (await this.findAfterShellRefresh(agent))
  }

  /** Ищет агента в перечитанном окружении оболочки, если прежнее уже устарело. */
  private async findAfterShellRefresh(agent: AgentId): Promise<string | null> {
    const environment = await this.shell.get()
    const fresh = await this.shell.fresh(MISSING_AGENT_REFRESH_INTERVAL_MS)
    if (fresh === environment) {
      return null
    }
    const found = await findAgents(fresh)
    this.executables = Promise.resolve(found)
    return found.get(agent) ?? null
  }

  /** Прошлый ответ; первый запрос ждёт поиска. Заодно в фоне начинается новый поиск. */
  private known(): Promise<Map<AgentId, string>> {
    const fresh = this.startDetection()
    if (!this.executables) {
      return fresh
    }
    // Фоновый поиск не удался — остаётся прошлый ответ.
    fresh.catch(() => undefined)
    return this.executables
  }

  private startDetection(): Promise<Map<AgentId, string>> {
    this.detecting ??= this.detect()
      .then((executables) => {
        this.executables = Promise.resolve(executables)
        return executables
      })
      .finally(() => {
        this.detecting = null
      })
    return this.detecting
  }

  private async detect(): Promise<Map<AgentId, string>> {
    return findAgents(await this.shell.get())
  }
}

/**
 * Куда установщики кладут программы агентов, даже когда их каталога нет в PATH: установщик
 * Claude Code пишет в `~/.local/bin` и только советует дописать его в PATH.
 */
const FALLBACK_DIRECTORIES = [join('.local', 'bin'), join('.claude', 'local')]

async function findAgents(environment: Record<string, string>): Promise<Map<AgentId, string>> {
  const directories = [
    ...(environment['PATH'] ?? '').split(delimiter).filter(Boolean),
    ...FALLBACK_DIRECTORIES.map((directory) => join(homedir(), directory))
  ]
  const found = new Map<AgentId, string>()
  for (const agent of AGENTS) {
    const path = await findProgram(agent.program, directories)
    if (path) {
      found.set(agent.id, path)
    }
  }
  return found
}

/**
 * Расширения программ Windows, которые запускаются по имени без расширения: npm ставит
 * агентов как `.cmd`, установщики — как `.exe`.
 */
const WINDOWS_PROGRAM_EXTENSIONS = ['.exe', '.cmd', '.bat']

export async function findProgram(
  name: string,
  directories: readonly string[]
): Promise<string | null> {
  const names = IS_WINDOWS ? WINDOWS_PROGRAM_EXTENSIONS.map((extension) => name + extension) : [name]
  for (const directory of directories) {
    for (const file of names) {
      const candidate = join(directory, file)
      try {
        // На Windows права на запуск не проверить: программой считается файл с её расширением.
        await access(candidate, IS_WINDOWS ? constants.F_OK : constants.X_OK)
        return candidate
      } catch {
        // В этом каталоге программы нет — ищем дальше.
      }
    }
  }
  return null
}
