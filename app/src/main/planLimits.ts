import { appendFile } from 'node:fs/promises'
import type { AgentId } from '../shared/agents'
import type { PlanLimit } from '../shared/conversation'
import type { PlanLimitsState } from '../shared/planLimits'
import { JsonFileWriter, readVersionedJson } from './jsonFile'

/** Первый запрос лимитов ждёт, пока приложение запустится: он запускает процессы агентов. */
const STARTUP_DELAY_MS = 5_000

/**
 * Как часто обновлять лимиты, пока агенты не работают. Пока работают, лимиты приходят
 * после каждого их ответа, и отдельный запрос не нужен.
 */
const REFRESH_INTERVAL_MS = 10 * 60 * 1000

/**
 * Как часто пробовать снова, если прошлый запрос провалился или вернул пустой ответ:
 * агент мог ещё не войти в аккаунт, и 10 минут — слишком долго, чтобы индикатор пустовал.
 */
const RETRY_INTERVAL_MS = 60 * 1000

/**
 * Сколько раз подряд пробовать часто. Пустой ответ бывает и постоянным — агент работает по
 * ключу API или не установлен вход, — и запускать его процесс каждую минуту вечно незачем.
 */
const FAST_RETRIES = 5

/** Лимиты свежее этого не перечитываются: ни по таймеру, ни при возвращении в окно. */
const FRESH_MS = 2 * 60 * 1000

const STATE_VERSION = 1

interface PlanLimitsFile {
  version: typeof STATE_VERSION
  state: PlanLimitsState
}

/** Аккаунт, лимиты которого читаются. */
export interface PlanLimitsTarget {
  /** Ключ лимитов аккаунта: `limitsKey`. */
  key: string
  agent: AgentId
  /** Дополнительный аккаунт; нет — основной. */
  account?: string
}

export interface PlanLimitsSources {
  /**
   * Аккаунты, у которых читаются лимиты: основные аккаунты установленных агентов и
   * дополнительные, в которые агент вошёл.
   */
  targets(): Promise<PlanLimitsTarget[]>
  /** Лимиты аккаунта без запущенной сессии агента — отдельным процессом агента. */
  read(target: PlanLimitsTarget): Promise<PlanLimit[]>
  onChange(state: PlanLimitsState): void
}

/**
 * Лимиты подписки аккаунтов агентов для постоянного индикатора: приходят от работающих сессий после
 * каждого ответа, а в остальное время перечитываются изредка и при возвращении в окно.
 * Последнее известное состояние хранится на диске: после перезапуска индикатор не пустует
 * те секунды, пока агент отвечает заново.
 */
export class PlanLimitsMonitor {
  private readonly reading = new Set<string>()
  /** Сколько раз подряд аккаунт ответил пусто или ошибкой: первые разы его перечитываем чаще. */
  private readonly misses = new Map<string, number>()
  /** Когда аккаунт спрашивали в последний раз — удачно или нет. */
  private readonly attemptedAt = new Map<string, number>()
  /** Последняя записанная в лог ошибка аккаунта: одна и та же беда не пишется каждую минуту. */
  private readonly loggedErrors = new Map<string, string>()
  private timer: ReturnType<typeof setTimeout> | null = null

  private constructor(
    private state: PlanLimitsState,
    private readonly sources: PlanLimitsSources,
    private readonly file: JsonFileWriter,
    private readonly logPath: string
  ) {}

  static async load(
    sources: PlanLimitsSources,
    filePath: string,
    logPath: string
  ): Promise<PlanLimitsMonitor> {
    const saved = await readVersionedJson<PlanLimitsFile>(filePath, STATE_VERSION)
    const file = new JsonFileWriter(filePath, { compact: true })
    return new PlanLimitsMonitor(saved?.state ?? {}, sources, file, logPath)
  }

  start(): void {
    // Что уже прочли с диска, окно видит сразу, не дожидаясь первого запроса к агенту.
    if (Object.keys(this.state).length > 0) {
      this.sources.onChange(this.state)
    }
    this.schedule(STARTUP_DELAY_MS)
  }

  stop(): void {
    if (this.timer) {
      clearTimeout(this.timer)
      this.timer = null
    }
  }

  get(): PlanLimitsState {
    return this.state
  }

  /** Лимиты аккаунта `key`, которые сообщила сессия агента. */
  report(key: string, limits: PlanLimit[]): void {
    this.state = { ...this.state, [key]: { limits, updatedAt: Date.now() } }
    if (limits.length === 0) {
      this.miss(key)
    } else {
      this.misses.delete(key)
      this.loggedErrors.delete(key)
    }
    this.file.write({ version: STATE_VERSION, state: this.state } satisfies PlanLimitsFile)
    this.sources.onChange(this.state)
  }

  /** Забывает лимиты аккаунта, которого больше нет. */
  forget(key: string): void {
    const { [key]: _removed, ...rest } = this.state
    this.state = rest
    this.misses.delete(key)
    this.attemptedAt.delete(key)
    this.loggedErrors.delete(key)
    this.file.write({ version: STATE_VERSION, state: this.state } satisfies PlanLimitsFile)
    this.sources.onChange(this.state)
  }

  /** Перечитывает устаревшие лимиты — например, когда пользователь вернулся в окно. */
  async refreshStale(): Promise<void> {
    const targets = await this.sources.targets().catch(() => [])
    await Promise.all(targets.filter(({ key }) => this.isStale(key)).map((target) => this.read(target)))
  }

  /** Перечитывает лимиты, даже если они ещё свежие — после `/login` или кнопки «Refresh». */
  async refreshAll(): Promise<void> {
    const targets = await this.sources.targets().catch(() => [])
    // Аккаунт мог смениться: частые попытки начинаются заново.
    this.misses.clear()
    await Promise.all(
      targets.filter(({ key }) => !this.reading.has(key)).map((target) => this.read(target))
    )
  }

  flush(): Promise<void> {
    return this.file.flush()
  }

  private schedule(delay: number): void {
    this.timer = setTimeout(() => {
      void this.refreshStale().finally(() => {
        if (this.timer) {
          // Если какие-то аккаунты не ответили лимитами, перечитываем их чаще — вход в аккаунт
          // мог ещё не завершиться.
          const retrying = [...this.misses.keys()].some((key) => this.retriesSoon(key))
          this.schedule(retrying ? RETRY_INTERVAL_MS : REFRESH_INTERVAL_MS)
        }
      })
    }, delay)
  }

  private isStale(key: string): boolean {
    if (this.reading.has(key)) {
      return false
    }
    // Неудачная попытка тоже считается: иначе аккаунт, который не отвечает, спрашивали бы
    // при каждом возвращении в окно.
    const last = Math.max(this.state[key]?.updatedAt ?? 0, this.attemptedAt.get(key) ?? 0)
    // Пустой ответ устаревает быстрее: агент только что мог войти в аккаунт.
    const fresh = this.retriesSoon(key) ? RETRY_INTERVAL_MS : FRESH_MS
    return Date.now() - last >= fresh
  }

  private miss(key: string): void {
    this.misses.set(key, (this.misses.get(key) ?? 0) + 1)
  }

  private retriesSoon(key: string): boolean {
    const misses = this.misses.get(key) ?? 0
    return misses > 0 && misses <= FAST_RETRIES
  }

  private async read(target: PlanLimitsTarget): Promise<void> {
    const { key } = target
    this.reading.add(key)
    this.attemptedAt.set(key, Date.now())
    try {
      this.report(key, await this.sources.read(target))
    } catch (error) {
      // Агент не вошёл в аккаунт или недоступен: индикатор показывает последние известные лимиты.
      this.miss(key)
      const text = errorText(error)
      if (this.loggedErrors.get(key) !== text) {
        this.loggedErrors.set(key, text)
        await this.log(`Failed to read ${key} plan limits: ${text}`)
      }
    } finally {
      this.reading.delete(key)
    }
  }

  private async log(line: string): Promise<void> {
    try {
      await appendFile(this.logPath, `${new Date().toISOString()} ${line}\n`)
    } catch {
      // Если лог записать не удалось, пусть ошибка не ломает основной поток.
    }
  }
}

function errorText(error: unknown): string {
  return error instanceof Error ? `${error.message}\n${error.stack ?? ''}` : String(error)
}
