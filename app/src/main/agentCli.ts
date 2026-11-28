import { execFile, spawn, type ChildProcess } from 'node:child_process'
import { existsSync } from 'node:fs'
import { realpath } from 'node:fs/promises'
import { delimiter, dirname, isAbsolute } from 'node:path'
import { promisify } from 'node:util'
import type {
  AgentCliAction,
  AgentCliActionKind,
  AgentCliStatus,
  AgentCliTargetBasis
} from '../shared/agentCli'
import { AGENTS, findAgent, type AgentId } from '../shared/agents'
import { IS_WINDOWS } from '../shared/platform'
import { compareVersions } from '../shared/update'
import { findProgram, type AgentDetector } from './agents'
import {
  detectInstallMethod,
  installCommand,
  npmNextTo,
  NPM_PACKAGES,
  updateCommand,
  type CliCommand
} from './agentCliCommands'
import { httpRequest } from './httpRequest'
import type { ShellEnvironment } from './shellEnvironment'

const execFileAsync = promisify(execFile)

/** Версия, которую агент должен уметь, чтобы работали лимиты и новые модели; подставляется при сборке. */
const CLAUDE_MINIMUM_VERSION = __CLAUDE_CODE_MIN_VERSION__

/** Сколько ждать ответа `--version`: зависшая программа не должна держать окно настроек. */
const VERSION_TIMEOUT_MS = 10_000

/** Сколько версия программы считается известной: её могли обновить в терминале. */
const VERSION_TTL_MS = 60_000

/** Последний выпуск агента смотрим в реестре npm; в ответе нужна только версия. */
const REGISTRY_URL = 'https://registry.npmjs.org'
const REGISTRY_TIMEOUT_MS = 5_000

/** Как долго помнить последний выпуск; при неудаче (нет сети) повторить скорее. */
const LATEST_TTL_MS = 6 * 60 * 60 * 1000
const LATEST_FAILURE_TTL_MS = 10 * 60 * 1000

/** Установка идёт дольше этого — значит, она зависла: процесс останавливается. */
const ACTION_TIMEOUT_MS = 10 * 60 * 1000

/** Сколько последних строк вывода команды сохраняется и показывается. */
const OUTPUT_LINES = 200

/** Не чаще раза в это время окно получает новый вывод команды: установщики пишут очень часто. */
const OUTPUT_EMIT_INTERVAL_MS = 100

/** Цвета и управление курсором в выводе установщиков. */
// eslint-disable-next-line no-control-regex
const ANSI_SEQUENCE = /\u001B\[[0-9;?]*[A-Za-z]/g

/** Версия вида `2.1.332` в выводе `--version`: `2.1.332 (Claude Code)`, `codex-cli 0.157.1`. */
const VERSION_PATTERN = /\d+\.\d+\.\d+/

interface CliCache {
  version: string | null
  readAt: number
}

/** Вывод команды по строкам: `\r` переписывает строку, как индикатор загрузки в терминале. */
class OutputTail {
  private lines: string[] = []
  private current = ''
  private carriageReturn = false

  push(chunk: string): void {
    for (const char of chunk.replace(ANSI_SEQUENCE, '')) {
      if (char === '\n') {
        this.lines.push(this.current)
        this.current = ''
        this.carriageReturn = false
      } else if (char === '\r') {
        this.carriageReturn = true
      } else {
        if (this.carriageReturn) {
          this.current = ''
          this.carriageReturn = false
        }
        this.current += char
      }
    }
    this.lines = this.lines.slice(-OUTPUT_LINES)
  }

  toString(): string {
    return [...this.lines, this.current].join('\n').trim()
  }
}

/**
 * Программы агентов на компьютере: какая версия установлена, не устарела ли и как её
 * установить или обновить. Atox запускает именно установленные программы, поэтому за их версией
 * следит сам: слишком старый Claude Code не умеет отдавать лимиты и новые модели.
 */
export class AgentCliService {
  /** Версии по пути к программе: `--version` запускается не на каждый вопрос. */
  private readonly versions = new Map<string, CliCache>()
  private readonly latest = new Map<AgentId, { version: string | null; readAt: number }>()
  private readonly actions = new Map<AgentId, AgentCliAction>()
  private readonly running = new Map<AgentId, ChildProcess>()
  private emitTimer: ReturnType<typeof setTimeout> | null = null

  constructor(
    private readonly detector: AgentDetector,
    private readonly shell: ShellEnvironment,
    private readonly events: {
      onChange(statuses: AgentCliStatus[]): void
      /** Программа агента установлена или обновлена: его списки и сессии нужно обновить. */
      onChanged(agent: AgentId): void
    }
  ) {}

  /** Состояние программ всех агентов. */
  async list(): Promise<AgentCliStatus[]> {
    return Promise.all(AGENTS.map(({ id }) => this.status(id)))
  }

  /** Ставит программу агента; ход установки приходит через `onChange`. */
  async install(agent: AgentId): Promise<void> {
    const command = installCommand(agent, IS_WINDOWS, await this.npm())
    if (!command) {
      throw new Error(`${cliName(agent)} can’t be installed from here: npm was not found.`)
    }
    this.start(agent, 'install', command)
  }

  /** Обновляет программу агента тем способом, которым она установлена. */
  async update(agent: AgentId): Promise<void> {
    const executable = await this.detector.executable(agent)
    if (!executable) {
      throw new Error(`${cliName(agent)} is not installed.`)
    }
    const command = await this.updateCommandFor(agent, executable)
    if (!command) {
      throw new Error(`Atox doesn’t know how ${cliName(agent)} was installed. Update it manually.`)
    }
    this.start(agent, 'update', command)
  }

  /** Убирает сообщение о неудачной установке или обновлении. */
  dismiss(agent: AgentId): void {
    if (this.actions.get(agent)?.state === 'failed') {
      this.actions.delete(agent)
      this.emit()
    }
  }

  /** Останавливает идущие установки: приложение закрывается. */
  close(): void {
    for (const child of this.running.values()) {
      killTree(child)
    }
  }

  private async status(agent: AgentId): Promise<AgentCliStatus> {
    const executable = await this.detector.executable(agent)
    const action = this.actions.get(agent) ?? null
    const npm = await this.npm()
    const install = installCommand(agent, IS_WINDOWS, npm)
    if (!executable) {
      return {
        agent,
        installed: false,
        executable: null,
        version: null,
        target: null,
        targetBasis: targetBasis(agent),
        outdated: false,
        installCommand: install?.display ?? null,
        updateCommand: null,
        action
      }
    }
    const [version, target, update] = await Promise.all([
      this.version(executable),
      this.target(agent),
      this.updateCommandFor(agent, executable)
    ])
    return {
      agent,
      installed: true,
      executable,
      version,
      target,
      targetBasis: targetBasis(agent),
      // Версию не узнали — не пугаем пользователя предупреждением, которое нечем проверить.
      outdated: version !== null && target !== null && compareVersions(version, target) < 0,
      installCommand: install?.display ?? null,
      updateCommand: update?.display ?? null,
      action
    }
  }

  /** Версия программы: из кеша или от самой программы; `null` — она не ответила. */
  private async version(executable: string): Promise<string | null> {
    const cached = this.versions.get(executable)
    if (cached && Date.now() - cached.readAt < VERSION_TTL_MS) {
      return cached.version
    }
    let version: string | null = null
    try {
      const { file, shell } = shellCommand(executable)
      const { stdout } = await execFileAsync(file, ['--version'], {
        env: await this.shell.get(),
        timeout: VERSION_TIMEOUT_MS,
        windowsHide: true,
        shell
      })
      version = VERSION_PATTERN.exec(stdout)?.[0] ?? null
    } catch (error) {
      console.error(`Failed to read the version of ${executable}`, error)
    }
    this.versions.set(executable, { version, readAt: Date.now() })
    return version
  }

  /**
   * Версия, с которой сравнивается установленная. У Claude Code это версия, на которую рассчитан
   * его SDK; у остальных — последний выпуск из npm, если реестр ответил.
   */
  private async target(agent: AgentId): Promise<string | null> {
    return agent === 'claude' ? CLAUDE_MINIMUM_VERSION : this.latestVersion(agent)
  }

  private async latestVersion(agent: AgentId): Promise<string | null> {
    const cached = this.latest.get(agent)
    if (cached) {
      const ttl = cached.version ? LATEST_TTL_MS : LATEST_FAILURE_TTL_MS
      if (Date.now() - cached.readAt < ttl) {
        return cached.version
      }
    }
    let version: string | null = null
    try {
      const response = await httpRequest(`${REGISTRY_URL}/${NPM_PACKAGES[agent]}/latest`, {
        signal: AbortSignal.timeout(REGISTRY_TIMEOUT_MS)
      })
      const body: unknown = await response.json()
      const found =
        typeof body === 'object' && body !== null ? (body as { version?: unknown }).version : null
      version = typeof found === 'string' && VERSION_PATTERN.test(found) ? found : null
    } catch (error) {
      // Нет сети — не повод что-то показывать: версию просто не с чем сравнить.
      console.error(`Failed to look up the latest ${agent} version`, error)
    }
    this.latest.set(agent, { version, readAt: Date.now() })
    return version
  }

  private async npm(): Promise<string | null> {
    const environment = await this.shell.get()
    const directories = (environment['PATH'] ?? '').split(delimiter).filter(Boolean)
    return findProgram('npm', directories)
  }

  private async updateCommandFor(agent: AgentId, executable: string): Promise<CliCommand | null> {
    const method = detectInstallMethod(agent, await realpath(executable).catch(() => executable))
    // npm рядом с программой — тот, которым её ставили; нет такого — npm из PATH.
    const sibling = npmNextTo(executable, existsSync, IS_WINDOWS)
    const npm = sibling ?? (await this.npm()) ?? 'npm'
    return updateCommand(agent, method, executable, npm)
  }

  private start(agent: AgentId, kind: AgentCliActionKind, command: CliCommand): void {
    if (this.running.has(agent)) {
      throw new Error(`${cliName(agent)} is already being changed.`)
    }
    const output = new OutputTail()
    const show = (failure?: string): void => {
      this.actions.set(agent, {
        kind,
        state: failure === undefined ? 'running' : 'failed',
        command: command.display,
        output: output.toString(),
        ...(failure !== undefined && { error: failure })
      })
      this.scheduleEmit()
    }
    show()
    this.emit()
    void this.run(agent, command, output, show)
      .then((failure) => failure ?? this.finish(agent, kind))
      .then((failure) => {
        this.running.delete(agent)
        if (failure === null) {
          this.actions.delete(agent)
          this.events.onChanged(agent)
        } else {
          show(failure)
        }
        this.emit()
      })
  }

  /** Запускает команду; `null` — она завершилась успешно, иначе — причина неудачи. */
  private async run(
    agent: AgentId,
    command: CliCommand,
    output: OutputTail,
    show: () => void
  ): Promise<string | null> {
    const environment = await this.shell.get()
    const { file, shell } = shellCommand(command.file)
    return new Promise((resolve) => {
      const child = spawn(file, command.args, {
        env: {
          ...environment,
          // Рядом с программой лежит и node, на котором работает npm.
          PATH: [isAbsolute(command.file) ? dirname(command.file) : '', environment['PATH']]
            .filter(Boolean)
            .join(delimiter)
        },
        stdio: ['ignore', 'pipe', 'pipe'],
        windowsHide: true,
        shell,
        // Своя группа процессов: установщик из `curl | bash` останавливается целиком.
        detached: !IS_WINDOWS
      })
      this.running.set(agent, child)
      const timer = setTimeout(() => {
        killTree(child)
        resolve(`It did not finish in ${ACTION_TIMEOUT_MS / 60_000} minutes and was stopped.`)
      }, ACTION_TIMEOUT_MS)
      const append = (chunk: Buffer): void => {
        output.push(chunk.toString('utf8'))
        show()
      }
      child.stdout?.on('data', append)
      child.stderr?.on('data', append)
      child.on('error', (error) => {
        clearTimeout(timer)
        resolve(error.message)
      })
      child.on('close', (code, signal) => {
        clearTimeout(timer)
        resolve(code === 0 ? null : `The command ${exitDescription(code, signal)}.`)
      })
    })
  }

  /**
   * После успешной команды: программа ищется заново, версии забываются. Если Atox по-прежнему
   * видит старую, команда обновила не ту установку — об этом говорится прямо.
   */
  private async finish(agent: AgentId, kind: AgentCliActionKind): Promise<string | null> {
    this.versions.clear()
    this.latest.delete(agent)
    await this.detector.redetect()
    const status = await this.status(agent)
    const name = cliName(agent)
    if (!status.installed) {
      return `${name} was not found after the installation. Check that its folder is in your PATH.`
    }
    if (kind === 'update' && status.outdated) {
      return `The update finished, but Atox still runs ${name} ${status.version} (${status.executable}).`
    }
    return null
  }

  /** Вывод приходит часто: окно получает его не чаще раза в интервал. */
  private scheduleEmit(): void {
    this.emitTimer ??= setTimeout(() => this.emit(), OUTPUT_EMIT_INTERVAL_MS)
  }

  private emit(): void {
    if (this.emitTimer) {
      clearTimeout(this.emitTimer)
      this.emitTimer = null
    }
    this.list()
      .then((statuses) => this.events.onChange(statuses))
      .catch((error) => console.error('Failed to read the agent CLI status', error))
  }
}

/**
 * Скрипты `.cmd` и `.bat` на Windows запускает только оболочка, а она делит команду по пробелам:
 * путь вроде `C:\Program Files\nodejs\npm.cmd` берётся в кавычки.
 */
function shellCommand(file: string): { file: string; shell: boolean } {
  const shell = /\.(cmd|bat)$/i.test(file)
  return { file: shell ? `"${file}"` : file, shell }
}

function cliName(agent: AgentId): string {
  return findAgent(agent)?.cliName ?? agent
}

function targetBasis(agent: AgentId): AgentCliTargetBasis {
  return agent === 'claude' ? 'minimum' : 'latest'
}

function exitDescription(code: number | null, signal: NodeJS.Signals | null): string {
  return signal ? `was stopped (${signal})` : `failed with exit code ${code}`
}

/** Останавливает команду вместе с тем, что она запустила. */
function killTree(child: ChildProcess): void {
  try {
    if (IS_WINDOWS || child.pid === undefined) {
      child.kill()
    } else {
      process.kill(-child.pid, 'SIGKILL')
    }
  } catch {
    // Команда уже завершилась.
  }
}
