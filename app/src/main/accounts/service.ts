import { randomBytes } from 'node:crypto'
import { homedir } from 'node:os'
import { join } from 'node:path'
import {
  ACCOUNT_NAME_MAX_LENGTH,
  mainAccountId,
  type AccountIdentity,
  type AgentAccount
} from '../../shared/accounts'
import { AGENTS, findAgent, isAgentId, type AgentId } from '../../shared/agents'
import type { AgentDetector } from '../agents'
import type { AccountSignIn, AgentDriver, AgentLaunch } from '../conversations/types'
import { JsonFileWriter, readVersionedJson } from '../jsonFile'
import { homeVariable, prepareAccountDirectory, removeAccountDirectory } from './sharedState'

const STATE_VERSION = 1

/** Название основного аккаунта: он у агента уже есть, Atox его не создаёт и не переименовывает. */
const MAIN_ACCOUNT_NAME = 'Main'

/** Идентификатор дополнительного аккаунта — он же имя его папки, поэтому только из таких символов. */
const ACCOUNT_ID = /^[a-f0-9]{8}$/

/** Дополнительный аккаунт, как он хранится на диске. */
interface StoredAccount {
  id: string
  agent: AgentId
  name: string
}

interface AccountsFile {
  version: typeof STATE_VERSION
  accounts: StoredAccount[]
}

interface Account {
  id: string
  agent: AgentId
  name: string
  main: boolean
}

export interface AccountServices {
  drivers: Record<AgentId, AgentDriver>
  agents: AgentDetector
  /** Окружение агента без выбора аккаунта. */
  environment(): Promise<Record<string, string>>
  openLink(url: string): void
  onChange(accounts: AgentAccount[]): void
  /**
   * Дополнительный аккаунт сейчас удалят: чаты, которые работали под ним, возвращаются
   * к основному, а их сессии закрываются, чтобы ничто не держало папку аккаунта.
   */
  onRemoving(agent: AgentId, accountId: string): void
  /** Вход в аккаунт завершён: списки моделей и лимиты подписки теперь другие. */
  onSignedIn(agent: AgentId): void
}

/**
 * Аккаунты агентов: основной у каждого агента и дополнительные, которые добавил пользователь.
 * У дополнительного своя папка в данных Atox (`accounts/<id>`) с входом и несколькими
 * личными файлами агента; всё остальное — история чатов, настройки, навыки, плагины —
 * ссылками общее с основным аккаунтом. Агент запускается с `CLAUDE_CONFIG_DIR` или `CODEX_HOME`,
 * указывающими на эту папку.
 *
 * Токены входа Atox не хранит и не читает: ими занимается сам агент.
 */
export class AccountService {
  /** Что известно о вошедшем аккаунте: `null` — агент не вошёл, нет записи — ещё не спрашивали. */
  private readonly identities = new Map<string, AccountIdentity | null>()
  private readonly signIns = new Map<string, AccountSignIn>()
  /** Подготовка папки каждого аккаунта идёт по очереди: две сразу переплели бы создание ссылок. */
  private readonly preparing = new Map<string, Promise<void>>()
  private refreshing: Promise<void> | null = null

  private constructor(
    private stored: StoredAccount[],
    private readonly services: AccountServices,
    private readonly file: JsonFileWriter,
    private readonly root: string
  ) {}

  static async load(
    services: AccountServices,
    filePath: string,
    root: string
  ): Promise<AccountService> {
    const saved = await readVersionedJson<AccountsFile>(filePath, STATE_VERSION)
    return new AccountService(
      normalizeStored(saved?.accounts),
      services,
      new JsonFileWriter(filePath),
      root
    )
  }

  /** Все аккаунты: у каждого агента сначала основной, затем дополнительные по порядку добавления. */
  list(): AgentAccount[] {
    return AGENTS.flatMap(({ id }) => this.accountsOf(id).map((account) => this.describe(account)))
  }

  /** Есть ли у агента такой дополнительный аккаунт. */
  has(agent: AgentId, accountId: string): boolean {
    return this.stored.some((account) => account.agent === agent && account.id === accountId)
  }

  /** Дополнительные аккаунты агента, в которые он вошёл: для них читаются лимиты подписки. */
  signedInExtras(agent: AgentId): string[] {
    return this.stored
      .filter(({ id, agent: owner }) => owner === agent && this.identities.get(id))
      .map(({ id }) => id)
  }

  /**
   * Что добавить к окружению агента, чтобы он работал под аккаунтом `accountId`; для основного
   * аккаунта — ничего: агент работает как в терминале. Неизвестный аккаунт — тоже основной.
   * `base` — окружение, из которого видно, где лежит папка основного аккаунта.
   */
  async environmentFor(
    agent: AgentId,
    accountId: string | undefined,
    base: Record<string, string>
  ): Promise<Record<string, string>> {
    const account = this.stored.find(({ id, agent: owner }) => id === accountId && owner === agent)
    if (!account) {
      return {}
    }
    const directory = this.directory(account.id)
    const previous = this.preparing.get(account.id) ?? Promise.resolve()
    const prepared = previous
      .catch(() => undefined)
      .then(() => prepareAccountDirectory(agent, directory, base))
    this.preparing.set(account.id, prepared)
    await prepared
    return { [homeVariable(agent)]: directory }
  }

  /** Перечитывает у агентов, в какие аккаунты они вошли. */
  async refresh(): Promise<AgentAccount[]> {
    this.refreshing ??= this.readIdentities().finally(() => {
      this.refreshing = null
    })
    await this.refreshing
    return this.list()
  }

  /** Добавляет аккаунт и готовит его папку; войти в него — отдельный шаг, `signIn`. */
  async add(agent: AgentId, name?: string): Promise<AgentAccount> {
    if (!(await this.services.agents.executable(agent))) {
      throw new Error(`${findAgent(agent)?.name ?? agent} is not installed.`)
    }
    const stored: StoredAccount = {
      id: randomBytes(4).toString('hex'),
      agent,
      name: normalizeName(name) ?? this.defaultName(agent)
    }
    this.stored = [...this.stored, stored]
    try {
      await this.environmentFor(agent, stored.id, await this.services.environment())
    } catch (error) {
      // Папку не удалось подготовить: аккаунта без папки не будет.
      this.stored = this.stored.filter((account) => account !== stored)
      throw error
    }
    this.save()
    this.services.onChange(this.list())
    return this.describe({ ...stored, main: false })
  }

  rename(accountId: string, name: string): void {
    const trimmed = normalizeName(name)
    const account = this.stored.find(({ id }) => id === accountId)
    if (!account || !trimmed) {
      throw new Error('Enter a name for the account.')
    }
    account.name = trimmed
    this.save()
    this.services.onChange(this.list())
  }

  /**
   * Удаляет дополнительный аккаунт: выходит из него и стирает его папку. История чатов,
   * настройки и всё остальное общее остаются у основного аккаунта.
   */
  async remove(accountId: string): Promise<void> {
    const account = this.stored.find(({ id }) => id === accountId)
    if (!account) {
      return
    }
    this.signIns.get(accountId)?.cancel()
    this.services.onRemoving(account.agent, accountId)
    // Выход убирает вход из связки ключей: папка стирается позже, а ключ иначе остался бы.
    // Если выйти не вышло, аккаунт всё равно удаляется — пользователь просил об этом.
    await this.launch({ ...account, main: false })
      .then((launch) => this.services.drivers[account.agent].signOut(launch))
      .catch((error) => console.error(`Failed to sign out of account ${accountId}`, error))
    await removeAccountDirectory(this.directory(accountId))
    this.stored = this.stored.filter(({ id }) => id !== accountId)
    this.identities.delete(accountId)
    this.preparing.delete(accountId)
    this.save()
    this.services.onChange(this.list())
  }

  /**
   * Входит в аккаунт: открывает страницу входа в браузере и ждёт, пока человек её пройдёт.
   * Завершается, когда вход закончен; отклоняется, если он не удался или его отменили.
   */
  async signIn(accountId: string): Promise<void> {
    const account = this.find(accountId)
    this.signIns.get(accountId)?.cancel()
    const signIn = await this.services.drivers[account.agent].signIn(await this.launch(account))
    this.signIns.set(accountId, signIn)
    this.services.openLink(signIn.url)
    try {
      await signIn.done
    } finally {
      if (this.signIns.get(accountId) === signIn) {
        this.signIns.delete(accountId)
      }
    }
    await this.readIdentity(account)
    this.services.onChange(this.list())
    this.services.onSignedIn(account.agent)
  }

  cancelSignIn(accountId: string): void {
    this.signIns.get(accountId)?.cancel()
  }

  flush(): Promise<void> {
    return this.file.flush()
  }

  private accountsOf(agent: AgentId): Account[] {
    return [
      { id: mainAccountId(agent), agent, name: MAIN_ACCOUNT_NAME, main: true },
      ...this.stored.filter((account) => account.agent === agent).map((a) => ({ ...a, main: false }))
    ]
  }

  private find(accountId: string): Account {
    const account = AGENTS.flatMap(({ id }) => this.accountsOf(id)).find(({ id }) => id === accountId)
    if (!account) {
      throw new Error('The account was not found.')
    }
    return account
  }

  private describe(account: Account): AgentAccount {
    const identity = this.identities.get(account.id)
    return {
      id: account.id,
      agent: account.agent,
      name: account.name,
      main: account.main,
      signedIn: identity === undefined ? null : identity !== null,
      ...(identity?.email && { email: identity.email }),
      ...(identity?.plan && { plan: identity.plan })
    }
  }

  private directory(accountId: string): string {
    return join(this.root, accountId)
  }

  /** «Account 2», «Account 3»…: первое название, которого у агента ещё нет. */
  private defaultName(agent: AgentId): string {
    const taken = new Set(this.accountsOf(agent).map(({ name }) => name))
    for (let number = this.accountsOf(agent).length + 1; ; number++) {
      const name = `Account ${number}`
      if (!taken.has(name)) {
        return name
      }
    }
  }

  private async launch(account: Account): Promise<AgentLaunch> {
    const executable = await this.services.agents.executable(account.agent)
    if (!executable) {
      throw new Error(`${findAgent(account.agent)?.name ?? account.agent} is not installed.`)
    }
    const base = await this.services.environment()
    const env = account.main ? {} : await this.environmentFor(account.agent, account.id, base)
    return { executable, cwd: homedir(), env: { ...base, ...env } }
  }

  private async readIdentities(): Promise<void> {
    await Promise.all(
      AGENTS.flatMap(({ id }) => this.accountsOf(id)).map((account) => this.readIdentity(account))
    )
    this.services.onChange(this.list())
  }

  /** Спрашивает агента, в какой аккаунт он вошёл; не ответил — остаётся прежний ответ. */
  private async readIdentity(account: Account): Promise<void> {
    try {
      const launch = await this.launch(account)
      this.identities.set(account.id, await this.services.drivers[account.agent].account(launch))
    } catch (error) {
      // Агент не установлен или не ответил: об этом не спрашиваем снова, пока не обновят список.
      console.error(`Failed to read the ${account.agent} account ${account.id}`, error)
    }
  }

  private save(): void {
    this.file.write({ version: STATE_VERSION, accounts: this.stored } satisfies AccountsFile)
  }
}

/** Название без лишних пробелов и не длиннее допустимого; `null` — пустое. */
function normalizeName(name: unknown): string | null {
  if (typeof name !== 'string') {
    return null
  }
  const trimmed = name.trim().slice(0, ACCOUNT_NAME_MAX_LENGTH).trim()
  return trimmed || null
}

/** Оставляет только записи, которым можно доверять: файл мог быть отредактирован вручную. */
function normalizeStored(value: unknown): StoredAccount[] {
  if (!Array.isArray(value)) {
    return []
  }
  const seen = new Set<string>()
  const accounts: StoredAccount[] = []
  for (const entry of value as Partial<StoredAccount>[]) {
    const name = normalizeName(entry?.name)
    if (
      typeof entry?.id === 'string' &&
      ACCOUNT_ID.test(entry.id) &&
      !seen.has(entry.id) &&
      isAgentId(entry.agent) &&
      name
    ) {
      seen.add(entry.id)
      accounts.push({ id: entry.id, agent: entry.agent, name })
    }
  }
  return accounts
}
