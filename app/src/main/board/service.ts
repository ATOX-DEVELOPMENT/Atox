import {
  DONE_VISIBLE_MS,
  isBoardColumn,
  isFixingStep,
  isReviewAgentStep,
  isReviewStep,
  type AvailableRepository,
  type BoardColumn,
  type BoardIssue,
  type BoardRepository,
  type BoardReview,
  type BoardState,
  type ReviewStep,
  type TaskAgent,
  type TaskStart
} from '../../shared/board'
import type { ConversationEvent, ConversationSnapshot } from '../../shared/conversation'
import { findAgent } from '../../shared/agents'
import type { AgentDetector } from '../agents'
import type { ConversationManager } from '../conversations/manager'
import type { GitHubAccounts } from '../githubAccounts'
import { JsonFileWriter, readVersionedJson } from '../jsonFile'
import { errorMessage } from '../processes'
import type { SettingsStore } from '../settings'
import type { ProjectStore } from '../store'
import type { BoardGitHub, GitHubIssue } from './github'
import { formatFixTask, formatIssueTask, formatReviewTask, parseVerdict, type FixKind } from './prompt'
import { blockingThreads, isReadyToMerge, type PullRequestStatus } from './pullRequest'
import { taskBranch, type BoardWorktrees } from './worktrees'

const BOARD_VERSION = 1

/** Сообщение агенту, когда задачу снова отдают ему в его же чате без слов от пользователя. */
const CONTINUE_MESSAGE = 'Continue working on the task.'

/**
 * Сколько раз подряд опрос может застать ветку pull request'а без коммита, который агент должен
 * был запушить, — потом доска считает, что он не запушил: GitHub обновляет ветку не мгновенно.
 */
const PUSH_WAIT_POLLS = 5

/** Через сколько после запуска и после чтения задач доска первый раз смотрит pull request'ы. */
const FIRST_POLL_DELAY_MS = 3_000

/** Причина остановки, когда pull request'а по ветке задачи нет: появится — доска продолжит. */
const NO_PULL_REQUEST = 'The agent finished without opening a pull request.'

/** Причина остановки, когда pull request закрыли без слияния: откроют снова — доска продолжит. */
const PULL_REQUEST_CLOSED = 'The pull request was closed without being merged.'

/** Что осталось не исправлено после последнего раунда: для причины остановки. */
const FIX_PROBLEMS: Record<FixKind, string> = {
  review: 'the reviewer still finds blocking problems',
  checks: 'the checks still fail',
  conflicts: 'the branch still conflicts with its base',
  comments: 'review comments are still open'
}

/** Ход проверки pull request'а задачи на колонках Review и Ready. */
interface Flow {
  step: ReviewStep
  /** Сколько раундов исправлений уже запущено. */
  round: number
  /** Проверяющий агент одобрил pull request. */
  approved: boolean
  /** Чего ждёт доска, если агентов сейчас нет. */
  detail?: string
  /** Почему доска остановилась и ждёт человека. */
  stopped?: string
  pullRequest?: { number: number; url: string }
  /** Чат проверяющего на шаге `reviewing`. */
  reviewChatId?: string
  /**
   * Коммит worktree, который агент должен был запушить: пока ветка pull request'а не на нём,
   * проверки на GitHub относятся к старому коду и решать по ним рано.
   */
  expectedHead?: string
  /** Сколько опросов подряд ветка не оказалась на `expectedHead`. */
  pushWaits?: number
  /** Коммит, для которого упавшие проверки уже перезапускали: второй раз не перезапускаем. */
  rerunHead?: string
  /** Доска ждёт свободного места для агента: освободится — продолжит сразу, не дожидаясь опроса. */
  needsAgent?: boolean
}

/** Где карточка задачи и что с ней делал агент. Задачи без записи лежат в бэклоге. */
interface Card {
  column: BoardColumn
  /** Учётная запись, под которой видна задача, — нужна, чтобы прочитать её, когда она закроется. */
  account: string
  /** Когда задачу поставили в очередь: агентам она достаётся по порядку. */
  queuedAt?: number
  chatId?: string
  error?: string
  /** Когда задачу перенесли в Done; через `DONE_VISIBLE_MS` она пропадает с доски. */
  doneAt?: number
  /** С каким агентом и сообщением задачу запустить; нет — с агентом доски из настроек. */
  start?: TaskStart
  /** Папка репозитория, из которой сделан worktree задачи: из неё его и убирают. */
  repositoryPath?: string
  /** Агент, который проверит pull request задачи; нет — проверки отдельным агентом не будет. */
  reviewer?: TaskAgent
  /** Проверка pull request'а; нет — доска за ним следит только ради слияния. */
  flow?: Flow
  /** Чаты проверяющих: на каждую проверку новый. Уходят вместе с чатом задачи. */
  reviewChatIds?: string[]
}

interface BoardFile {
  version: typeof BOARD_VERSION
  repositories: BoardRepository[]
  cards: Record<string, Card>
}

export interface BoardServices {
  github: BoardGitHub
  worktrees: BoardWorktrees
  accounts: GitHubAccounts
  store: ProjectStore
  settings: SettingsStore
  conversations: ConversationManager
  agents: AgentDetector
  onChange(state: BoardState): void
  /** Появился проект или чат: окну нужен новый список. */
  onProjectsChanged(): void
}

/**
 * Доска задач. Задачи — открытые issue выбранных репозиториев; колонку каждой помнит Atox.
 * Задача в очереди уходит агенту, как только работающих агентов доски меньше предела из
 * настроек, а когда агент закончит ход — переходит на проверку.
 */
export class BoardService {
  private issues: GitHubIssue[] = []
  private syncedAt: number | null = null
  private syncing: Promise<void> | null = null
  private error: string | null = null
  /** Задачи, агентов которых сейчас готовят: клонируют репозиторий, создают worktree. */
  private readonly starting = new Set<string>()
  /** Следующий опрос pull request'ов на проверке. */
  private pollTimer: ReturnType<typeof setTimeout> | null = null
  /** Задачи, pull request'ы которых читают сейчас: опросы не наезжают друг на друга. */
  private readonly evaluating = new Set<string>()
  /** Atox закрывается: опросы больше не запускаются. */
  private closed = false

  private constructor(
    private readonly services: BoardServices,
    private readonly file: JsonFileWriter,
    private repositories: BoardRepository[],
    private readonly cards: Map<string, Card>
  ) {}

  static async load(services: BoardServices, filePath: string): Promise<BoardService> {
    const data = await readVersionedJson<BoardFile>(filePath, BOARD_VERSION)
    const repositories = Array.isArray(data?.repositories)
      ? data.repositories.filter(isBoardRepository)
      : []
    const cards = new Map<string, Card>()
    for (const [id, card] of Object.entries(data?.cards ?? {})) {
      if (isBoardColumn(card?.column) && typeof card.account === 'string') {
        // Задачи в Done из прежних версий получают отсчёт с первого запуска.
        if (card.column === 'done' && typeof card.doneAt !== 'number') {
          card.doneAt = Date.now()
        }
        // Ход агента не переживает перезапуск Atox: без работающего агента задача — на проверке.
        if (
          card.column === 'progress' &&
          !(card.chatId && services.conversations.isRunning(card.chatId))
        ) {
          card.column = 'review'
        }
        // Проверяющий и исправляющий агенты не переживают перезапуск Atox: проверка начинается
        // с опроса GitHub — что нужно, доска запустит заново.
        if (card.flow) {
          card.flow = restoreFlow(card.flow)
          if (!card.flow) {
            delete card.flow
          }
        }
        cards.set(id, card)
      }
    }
    const board = new BoardService(services, new JsonFileWriter(filePath), repositories, cards)
    // Задачи из очереди уходят агентам, только когда прочитаны их issue, — не дожидаясь,
    // пока пользователь откроет доску.
    if ([...cards.values()].some(({ column }) => ['queue', 'review', 'ready'].includes(column))) {
      void board.refresh()
    }
    return board
  }

  state(): BoardState {
    const shown = new Set(this.repositories.map(({ fullName }) => fullName))
    return {
      repositories: this.repositories,
      issues: this.issues
        .filter((issue) => shown.has(issue.repository) && !this.isRetired(issue.id))
        .map((issue) => this.toBoardIssue(issue)),
      syncedAt: this.syncedAt,
      syncing: this.syncing !== null,
      error: this.error
    }
  }

  /** Перечитывает задачи с GitHub; идущее чтение не начинается заново, а дожидается. */
  refresh(): Promise<BoardState> {
    this.syncing ??= this.sync().finally(() => {
      this.syncing = null
      this.changed()
    })
    this.changed()
    return this.syncing.then(() => this.state())
  }

  availableRepositories(): Promise<AvailableRepository[]> {
    return this.services.github.availableRepositories()
  }

  setRepositories(repositories: BoardRepository[]): Promise<BoardState> {
    this.repositories = repositories.filter(isBoardRepository)
    this.persist()
    return this.refresh()
  }

  /** Проект, под которым чат агента появится без выбора: копия репозитория среди проектов. */
  async defaultProjectId(repository: string): Promise<string | null> {
    const project = await this.services.worktrees.findProject(this.services.store.list(), repository)
    return project?.id ?? null
  }

  /** Чат агента задачи; нет — агент над ней не работал. */
  chatOf(issueId: string): string | undefined {
    return this.cards.get(issueId)?.chatId
  }

  move(issueId: string, target: BoardColumn, start?: TaskStart): BoardState {
    const issue = this.issues.find(({ id }) => id === issueId)
    if (!issue) {
      throw new Error('The task is no longer on the board.')
    }
    const card: Card = this.cards.get(issueId) ?? { column: target, account: this.accountOf(issue) }
    const agentRunning =
      card.chatId !== undefined && this.services.conversations.isRunning(card.chatId)
    // «В работу» без работающего агента — значит запустить его: задача встаёт в очередь
    // и уходит агенту сразу, если есть свободное место.
    const column = target === 'progress' && !agentRunning ? 'queue' : target
    // Задачу вернули в бэклог — её агента останавливают; чат и worktree остаются.
    if (column === 'backlog' && agentRunning && card.chatId) {
      void this.services.conversations.interrupt(card.chatId)
    }
    card.column = column
    delete card.error
    // Перенос вручную обрывает проверку: её агент останавливается, а дальше доска только следит.
    void this.stopReviewer(card)
    delete card.flow
    if (column === 'done') {
      card.doneAt = Date.now()
      void this.retireAgent(card)
    } else {
      delete card.doneAt
    }
    if (column === 'queue') {
      card.queuedAt = Date.now()
      if (start) {
        card.start = start
        if (start.review) {
          card.reviewer = start.review
        } else {
          delete card.reviewer
        }
      } else {
        delete card.start
        delete card.reviewer
      }
    } else {
      delete card.queuedAt
    }
    // В бэклоге без чата карточка ничего не помнит: задача там и без неё.
    if (column === 'backlog' && !card.chatId) {
      this.cards.delete(issueId)
    } else {
      this.cards.set(issueId, card)
    }
    this.persist()
    this.changed()
    this.startQueued()
    this.armPoller()
    return this.state()
  }

  /**
   * Агент задачи закончил ход — задача уходит на проверку, а её место — следующей в очереди.
   * Агент задачи на проверке снова взялся за работу (ему написали в чате) — она снова в работе.
   * Исправляющий агент и проверяющий заканчивают свои ходы внутри проверки: продолжает её доска.
   */
  onConversationEvent(event: ConversationEvent): void {
    if (event.type !== 'running') {
      return
    }
    const entry = [...this.cards.entries()].find(
      ([, { chatId, flow }]) => chatId === event.chatId || flow?.reviewChatId === event.chatId
    )
    if (!entry) {
      return
    }
    const [id, card] = entry
    if (card.flow?.reviewChatId === event.chatId) {
      if (!event.running) {
        void this.finishReview(id, card, event.chatId)
      }
    } else if (card.flow && isFixingStep(card.flow.step) && card.chatId === event.chatId) {
      if (!event.running) {
        void this.finishFix(id, card, event.chatId)
      }
    } else if (event.running && (card.column === 'review' || card.column === 'ready')) {
      // Человек написал агенту сам: проверка начнётся заново, когда агент закончит.
      void this.stopReviewer(card)
      delete card.flow
      card.column = 'progress'
      this.persist()
      this.changed()
    } else if (!event.running && card.column === 'progress') {
      void this.finishTurn(card, event.chatId)
    }
  }

  /** Число агентов из настроек изменилось — в очереди могли освободиться места. */
  onSettingsChanged(): void {
    this.startQueued()
  }

  private async sync(): Promise<void> {
    try {
      const repositories = this.repositories
      const results = await Promise.allSettled(
        repositories.map((repository) => this.services.github.openIssues(repository))
      )
      const issues: GitHubIssue[] = []
      const failures: string[] = []
      results.forEach((result, index) => {
        const { fullName } = repositories[index]!
        if (result.status === 'fulfilled') {
          issues.push(...result.value)
        } else {
          // Задачи репозитория, который не прочитался, остаются прежними, а не пропадают.
          console.error(`Failed to sync ${fullName} on the board`, result.reason)
          failures.push(`${fullName}: ${errorMessage(result.reason)}`)
          issues.push(...this.issues.filter(({ repository }) => repository === fullName))
        }
      })
      // Закрытые задачи с карточками дочитываются по id: иначе они пропали бы из колонок.
      const known = new Set(issues.map(({ id }) => id))
      const missing = new Map<string, string[]>()
      for (const [id, card] of this.cards) {
        if (!known.has(id) && !this.isRetired(id)) {
          missing.set(card.account, [...(missing.get(card.account) ?? []), id])
        }
      }
      for (const [account, ids] of missing) {
        issues.push(...(await this.services.github.issuesById(account, ids).catch(() => [])))
      }
      if (this.pruneCards(issues, repositories, failures.length === 0)) {
        this.persist()
      }
      const shown = new Set(repositories.map(({ fullName }) => fullName))
      // Закрытая задача видна, только пока у неё есть карточка.
      this.issues = issues
        .filter(
          ({ id, repository, state }) =>
            shown.has(repository) && (state === 'open' || this.cards.has(id))
        )
        .sort((left, right) => right.updatedAt - left.updatedAt)
      this.syncedAt = Date.now()
      this.error = failures.length > 0 ? failures.join('; ') : null
      this.startQueued()
      this.armPoller(true)
    } catch (error) {
      console.error('Failed to sync the board', error)
      this.error = errorMessage(error)
    }
  }

  /**
   * Убирает карточки, которые доске больше не нужны: задач из убранных с доски репозиториев,
   * закрытых задач в бэклоге и давно ушедших из Done закрытых задач. Ушедшая из Done открытая
   * задача карточку сохраняет — иначе она вернулась бы в бэклог. `true` — что-то убрано.
   */
  private pruneCards(
    issues: readonly GitHubIssue[],
    repositories: readonly BoardRepository[],
    complete: boolean
  ): boolean {
    const before = this.cards.size
    const shown = new Set(repositories.map(({ fullName }) => fullName))
    const byId = new Map(issues.map((issue) => [issue.id, issue]))
    for (const [id, card] of this.cards) {
      const issue = byId.get(id)
      const removed =
        (issue !== undefined && !shown.has(issue.repository)) ||
        (issue?.state === 'closed' && card.column === 'backlog') ||
        // Открытые задачи читаются только целиком: без ошибок видно, что этой среди них нет.
        (complete && issue === undefined && this.isRetired(id))
      if (removed) {
        this.cards.delete(id)
      }
    }
    return this.cards.size !== before
  }

  /** Отдаёт агентам задачи из очереди, пока работающих меньше предела; без предела — все. */
  private startQueued(): void {
    const limit = this.agentLimit()
    const working = this.workingCount()
    // Задачи репозиториев, убранных с доски, агентам не уходят.
    const shown = new Set(this.repositories.map(({ fullName }) => fullName))
    const queued = [...this.cards.entries()]
      .filter(([id, card]) => card.column === 'queue' && !this.starting.has(id))
      .sort(([, left], [, right]) => (left.queuedAt ?? 0) - (right.queuedAt ?? 0))
      .flatMap(([id]) => this.issues.filter((issue) => issue.id === id && shown.has(issue.repository)))
    for (const issue of queued.slice(0, Math.max(0, limit - working))) {
      void this.start(issue)
    }
    // Проверка, которой не хватило места для агента, продолжается, как только оно освободилось.
    if (working < limit) {
      for (const [id, card] of this.cards) {
        if (card.flow?.needsAgent) {
          void this.evaluate(id, card)
        }
      }
    }
  }

  /** Сколько агентов доски могут работать сразу; без предела в настройках — сколько угодно. */
  private agentLimit(): number {
    return this.services.settings.get().boardMaxAgents ?? Infinity
  }

  /** Сколько агентов доски занято: работают над задачами, проверяют, исправляют или готовятся. */
  private workingCount(): number {
    const { conversations } = this.services
    const running = (chatId?: string) => chatId !== undefined && conversations.isRunning(chatId)
    return [...this.cards.entries()].filter(
      ([id, { column, chatId, flow }]) =>
        this.starting.has(id) ||
        (column === 'progress' && running(chatId)) ||
        (flow !== undefined &&
          (running(flow.reviewChatId) || (isReviewAgentStep(flow.step) && running(chatId))))
    ).length
  }

  private async start(issue: GitHubIssue): Promise<void> {
    const card = this.cards.get(issue.id)
    if (!card) {
      return
    }
    this.starting.add(issue.id)
    this.changed()
    try {
      const { store, settings, worktrees, accounts, github, conversations } = this.services
      const token = await accounts.token(card.account)
      if (!token) {
        throw new Error(`GitHub account ${card.account} is not signed in to gh.`)
      }
      const { agent, model, effort } = card.start?.agent ?? settings.get().boardAgent
      if (!(await this.services.agents.list()).includes(agent)) {
        throw new Error(`${findAgent(agent)?.name ?? agent} is not installed.`)
      }
      // Проект, выбранный в окне запуска, мог исчезнуть, пока задача ждала, — тогда проект по умолчанию.
      const chosen = store.list().find(({ id }) => id === card.start?.projectId)
      const { repository, project, worktree } = await worktrees.exclusive(
        issue.repository,
        async () => {
          // Worktree делается из копии репозитория: выбранный проект подходит, если он и есть копия,
          // иначе — из проекта репозитория или свежего клона. Чат встаёт под выбранный проект.
          let repository = await worktrees.findProject(
            chosen ? [chosen, ...store.list()] : store.list(),
            issue.repository
          )
          if (!repository) {
            const path = await worktrees.clone(issue.repository, token)
            repository = store.addProject(path, store.listSpaces().activeSpaceId)
          }
          const worktree = await worktrees.create(
            repository.path,
            issue.repository,
            issue.number,
            token
          )
          return { repository, project: chosen ?? repository, worktree }
        }
      )
      // Агент уже работал над задачей — он продолжает в своём чате, а не начинает в новом.
      const chatId = card.chatId && store.findChat(card.chatId) ? card.chatId : undefined
      const body = chatId ? '' : await github.issueBody(card.account, issue.id)
      // Пока готовили worktree, задачу могли убрать из очереди — агента тогда не запускают,
      // а worktree задачи, перенесённой в Done, убирают, как и при переносе.
      if (this.cards.get(issue.id) !== card || card.column !== 'queue') {
        if (card.column === 'done') {
          await worktrees
            .remove(repository.path, worktree.path)
            .catch((error) => console.error('Failed to remove the task worktree', error))
        }
        return
      }
      card.column = 'progress'
      card.repositoryPath = repository.path
      delete card.queuedAt
      if (chatId) {
        if (card.start) {
          await conversations.configure(chatId, {
            agent,
            model: model ?? null,
            effort: effort ?? null
          })
          this.services.onProjectsChanged()
        }
        await conversations.send(chatId, card.start?.message ?? CONTINUE_MESSAGE)
        return
      }
      const selection = { ...(model && { model }), ...(effort && { effort }) }
      const chat = store.createTaskChat(project.id, agent, selection, {
        title: `#${issue.number} ${issue.title}`,
        worktree: worktree.path,
        githubAccount: card.account
      })
      card.chatId = chat.id
      this.services.onProjectsChanged()
      await conversations.send(
        chat.id,
        formatIssueTask(issue, body, worktree, card.start?.message),
        {},
        // Чат назван по задаче, а не по служебному началу задания.
        { titleFrom: issue.title }
      )
    } catch (error) {
      console.error(`Failed to start an agent for ${issue.repository}#${issue.number}`, error)
      // Задача возвращается в бэклог с причиной: оставшись в очереди, она пробовала бы снова
      // и снова. Задачу, которую тем временем перенесли, не трогают.
      if (card.column === 'queue' || card.column === 'progress') {
        card.column = 'backlog'
        card.error = errorMessage(error)
        delete card.queuedAt
      }
    } finally {
      this.starting.delete(issue.id)
      this.persist()
      this.changed()
      // Место, которое заняла подготовка, освободилось, если агента так и не запустили.
      this.startQueued()
    }
  }

  /** Агент закончил ход: штатно — задача уходит на проверку, с ошибкой — в бэклог с причиной. */
  private async finishTurn(card: Card, chatId: string): Promise<void> {
    const { conversations } = this.services
    const error = turnError(await conversations.snapshot(chatId).catch(() => null))
    // Что агент закончил, должно быть на GitHub: по ветке pull request'а это и проверят.
    const head = await this.localHead(card)
    // Пока читали ленту, задачу могли перенести, а агент — взяться за следующее сообщение.
    if (card.column !== 'progress' || card.chatId !== chatId || conversations.isRunning(chatId)) {
      return
    }
    if (error) {
      card.column = 'backlog'
      card.error = error
    } else {
      card.column = 'review'
      card.flow = { step: 'waiting', round: 0, approved: false, ...(head && { expectedHead: head }) }
    }
    this.persist()
    this.changed()
    this.startQueued()
    const entry = [...this.cards.entries()].find(([, other]) => other === card)
    if (entry && card.flow) {
      void this.evaluate(entry[0], card)
      this.armPoller()
    }
  }

  /** Планирует опрос pull request'ов на проверке, если на доске есть что опрашивать. */
  private armPoller(first = false): void {
    const watched = [...this.cards.values()].some(
      ({ column }) => column === 'review' || column === 'ready'
    )
    if (this.pollTimer || this.closed || !watched) {
      return
    }
    const delay = first ? FIRST_POLL_DELAY_MS : this.services.settings.get().boardPollSeconds * 1000
    this.pollTimer = setTimeout(() => {
      this.pollTimer = null
      void this.pollAll().finally(() => this.armPoller())
    }, delay)
    this.pollTimer.unref()
  }

  private async pollAll(): Promise<void> {
    for (const [id, card] of [...this.cards]) {
      if (this.closed) {
        return
      }
      if (card.column === 'review' || card.column === 'ready') {
        await this.evaluate(id, card)
      }
    }
  }

  /** Читает pull request задачи с GitHub и решает, что с ней дальше. */
  private async evaluate(id: string, card: Card): Promise<void> {
    const issue = this.issues.find((item) => item.id === id)
    const repository = this.repositories.find(({ fullName }) => fullName === issue?.repository)
    if (!issue || !repository || this.evaluating.has(id)) {
      return
    }
    this.evaluating.add(id)
    try {
      const status = await this.services.github.pullRequest(repository, taskBranch(issue.number))
      // Пока читали GitHub, задачу могли перенести или убрать.
      if (this.cards.get(id) === card && (card.column === 'review' || card.column === 'ready')) {
        await this.apply(id, card, issue, status)
      }
    } catch (error) {
      console.error(`Failed to check the pull request of ${issue.repository}#${issue.number}`, error)
      if (card.flow?.step === 'waiting') {
        card.flow.detail = `Can’t read the pull request: ${errorMessage(error)}`
        this.changed()
      }
    } finally {
      this.evaluating.delete(id)
    }
  }

  private async apply(
    id: string,
    card: Card,
    issue: GitHubIssue,
    status: PullRequestStatus | null
  ): Promise<void> {
    // Смерженная задача закрыта — и та, которую доска ведёт, и та, за которой она лишь следит.
    if (status?.state === 'merged') {
      this.move(id, 'done')
      return
    }
    const flow = card.flow
    if (!flow) {
      return
    }
    if (!status || status.state === 'closed') {
      const reason = status ? PULL_REQUEST_CLOSED : NO_PULL_REQUEST
      if (flow.step !== 'stopped' || flow.stopped !== reason) {
        this.stop(card, reason)
      }
      return
    }
    flow.pullRequest = { number: status.number, url: status.url }
    if (flow.step === 'stopped') {
      // Остановку из-за отсутствия или закрытия pull request'а снимает его появление.
      if (flow.stopped !== NO_PULL_REQUEST && flow.stopped !== PULL_REQUEST_CLOSED) {
        return
      }
      delete flow.stopped
      flow.step = 'waiting'
    }
    if (!isReviewAgentStep(flow.step)) {
      await this.decide(id, card, flow, issue, status)
    }
    this.persist()
    this.changed()
  }

  /** Что делать с pull request'ом, пока агентов на нём нет: ждать, перезапустить, звать агента. */
  private async decide(
    id: string,
    card: Card,
    flow: Flow,
    issue: GitHubIssue,
    status: PullRequestStatus
  ): Promise<void> {
    if (flow.expectedHead) {
      if (status.headSha === flow.expectedHead) {
        delete flow.expectedHead
        delete flow.pushWaits
      } else {
        flow.pushWaits = (flow.pushWaits ?? 0) + 1
        if (flow.pushWaits > PUSH_WAIT_POLLS) {
          this.stop(card, 'The agent’s latest commits are not pushed to the pull request.')
        } else {
          this.wait(card, 'Waiting for the push to reach GitHub')
        }
        return
      }
    }
    if (isReadyToMerge(status, card.reviewer === undefined || flow.approved)) {
      card.column = 'ready'
      flow.step = 'waiting'
      delete flow.detail
      delete flow.needsAgent
      return
    }
    // Готовая задача, в которой что-то изменилось, снова на проверке.
    if (card.column === 'ready') {
      card.column = 'review'
    }
    if (status.outdated) {
      await this.fix(id, card, flow, 'conflicts', [`Base branch: ${status.baseBranch}`])
    } else if (card.reviewer && !flow.approved) {
      await this.review(id, card, flow, issue, status)
    } else if (status.checks.pending.length > 0) {
      this.wait(card, `Waiting for checks (${status.checks.pending.length} running)`)
    } else if (status.checks.failed.length > 0) {
      await this.handleFailedChecks(id, card, flow, issue, status)
    } else if (blockingThreads(status).length > 0 || status.changesRequested) {
      const threads = blockingThreads(status).map(
        ({ path, line, url, excerpt }) =>
          `${path ? `${path}${line ? `:${line}` : ''}` : 'General'} — ${url} — ${excerpt}`
      )
      await this.fix(id, card, flow, 'comments', [
        ...(status.changesRequested ? ['Changes were requested on the pull request.'] : []),
        ...threads
      ])
    } else {
      this.wait(card, status.mergeBlocker ?? 'Waiting for GitHub')
    }
  }

  /** Упавшие проверки: сначала один перезапуск — CI бывает нестабильным, — потом агент. */
  private async handleFailedChecks(
    id: string,
    card: Card,
    flow: Flow,
    issue: GitHubIssue,
    status: PullRequestStatus
  ): Promise<void> {
    const runIds = [...new Set(status.checks.failed.flatMap(({ runId }) => runId ?? []))]
    const repository = this.repositories.find(({ fullName }) => fullName === issue.repository)
    if (flow.rerunHead !== status.headSha && runIds.length > 0 && repository) {
      flow.rerunHead = status.headSha
      try {
        await Promise.all(runIds.map((runId) => this.services.github.rerunFailedJobs(repository, runId)))
      } catch (error) {
        this.stop(card, `Couldn’t re-run the failed checks: ${errorMessage(error)}`)
        return
      }
      this.wait(card, 'Re-running the failed checks')
      return
    }
    await this.fix(
      id,
      card,
      flow,
      'checks',
      status.checks.failed.map(
        ({ name, url, runId }) =>
          `${name}${url ? ` — ${url}` : ''}${runId ? ` (run id ${runId})` : ''}`
      )
    )
  }

  /**
   * Агент задачи правит то, что нашла проверка, — в своём чате, где он знает свой код. Раундов
   * не больше, чем в настройках; без свободного места доска ждёт. `force` — место уже занято
   * проверяющим, который только что закончил.
   */
  private async fix(
    id: string,
    card: Card,
    flow: Flow,
    kind: FixKind,
    details: string[],
    force = false
  ): Promise<void> {
    const { store, conversations, settings } = this.services
    const { boardMaxRounds } = settings.get()
    if (flow.round >= boardMaxRounds) {
      this.stop(card, `Still not clean after ${boardMaxRounds} rounds of fixes: ${FIX_PROBLEMS[kind]}.`)
      return
    }
    if (!force && this.workingCount() >= this.agentLimit()) {
      this.wait(card, 'Waiting for a free agent', true)
      return
    }
    if (!card.chatId || !store.findChat(card.chatId) || !flow.pullRequest) {
      this.stop(card, 'The task’s chat is gone, so there is no agent to fix it.')
      return
    }
    flow.round += 1
    flow.step = `fixing-${kind}`
    delete flow.detail
    delete flow.needsAgent
    this.starting.add(id)
    this.changed()
    try {
      await conversations.send(card.chatId, formatFixTask(kind, flow.pullRequest, details))
    } catch (error) {
      console.error('Failed to send the fix to the task agent', error)
      this.stop(card, `Couldn’t start the agent: ${errorMessage(error)}`)
    } finally {
      this.starting.delete(id)
    }
  }

  /** Новый агент в новом чате, без общего контекста с автором, проверяет pull request. */
  private async review(
    id: string,
    card: Card,
    flow: Flow,
    issue: GitHubIssue,
    status: PullRequestStatus
  ): Promise<void> {
    const { store, conversations, agents, github } = this.services
    const reviewer = card.reviewer
    if (!reviewer) {
      return
    }
    if (this.workingCount() >= this.agentLimit()) {
      this.wait(card, 'Waiting for a free agent', true)
      return
    }
    if (!(await agents.list()).includes(reviewer.agent)) {
      this.stop(card, `${findAgent(reviewer.agent)?.name ?? reviewer.agent} is not installed, so it can’t review.`)
      return
    }
    const location = card.chatId ? store.findChat(card.chatId) : undefined
    const worktree = location?.chat.worktree
    if (!card.chatId || !location || !worktree) {
      this.stop(card, 'The task’s chat is gone, so there is no worktree to review in.')
      return
    }
    this.starting.add(id)
    try {
      const body = await github.issueBody(card.account, issue.id)
      const { model, effort } = reviewer
      const chat = store.createTaskChat(
        location.project.id,
        reviewer.agent,
        { ...(model && { model }), ...(effort && { effort }) },
        {
          title: `Review: #${issue.number} ${issue.title}`,
          worktree,
          githubAccount: card.account
        }
      )
      card.reviewChatIds = [...(card.reviewChatIds ?? []), chat.id]
      flow.reviewChatId = chat.id
      flow.step = 'reviewing'
      delete flow.detail
      delete flow.needsAgent
      this.persist()
      this.services.onProjectsChanged()
      this.changed()
      // Агент задачи в проверке не участвует: его сессия закрыта, а чат остаётся в истории.
      await conversations.close(card.chatId)
      await conversations.send(
        chat.id,
        formatReviewTask(issue, body, status, { path: worktree, branch: taskBranch(issue.number) })
      )
    } catch (error) {
      console.error('Failed to start the reviewer', error)
      this.stop(card, `Couldn’t start the reviewer: ${errorMessage(error)}`)
    } finally {
      this.starting.delete(id)
    }
  }

  /** Проверяющий закончил: одобрил — доска ждёт проверки, нашёл ошибки — их правит автор. */
  private async finishReview(id: string, card: Card, chatId: string): Promise<void> {
    const { conversations } = this.services
    const snapshot = await conversations.snapshot(chatId).catch(() => null)
    const flow = card.flow
    if (!flow || flow.reviewChatId !== chatId || conversations.isRunning(chatId)) {
      return
    }
    delete flow.reviewChatId
    const error = turnError(snapshot)
    const verdict = error ? null : parseVerdict(lastAnswer(snapshot))
    if (error) {
      this.stop(card, `The reviewer stopped: ${error}`)
    } else if (verdict === null) {
      this.stop(card, 'The reviewer finished without a verdict. Open its chat to see why.')
    } else if (verdict === 'approve') {
      flow.approved = true
      flow.step = 'waiting'
      this.persist()
      this.changed()
      void this.evaluate(id, card)
      return
    } else if (flow.pullRequest) {
      await this.fix(id, card, flow, 'review', [], true)
    } else {
      this.stop(card, NO_PULL_REQUEST)
    }
    this.persist()
    this.changed()
  }

  /** Агент задачи закончил исправления: доска ждёт, пока они дойдут до GitHub и проверки пройдут. */
  private async finishFix(id: string, card: Card, chatId: string): Promise<void> {
    const { conversations } = this.services
    const error = turnError(await conversations.snapshot(chatId).catch(() => null))
    const head = await this.localHead(card)
    const flow = card.flow
    if (!flow || !isFixingStep(flow.step) || card.chatId !== chatId || conversations.isRunning(chatId)) {
      return
    }
    if (error) {
      this.stop(card, `The agent stopped: ${error}`)
    } else {
      // После исправления проверяющего нужен новый: он смотрит уже исправленный код.
      flow.approved = flow.approved && flow.step !== 'fixing-review'
      flow.step = 'waiting'
      if (head) {
        flow.expectedHead = head
        flow.pushWaits = 0
      }
      void this.evaluate(id, card)
    }
    this.persist()
    this.changed()
    this.startQueued()
  }

  /** Останавливает проверяющего задачи, если он работает: задачу перенесли или к ней вернулся человек. */
  private async stopReviewer(card: Card): Promise<void> {
    const chatId = card.flow?.reviewChatId
    if (chatId) {
      await this.services.conversations.interrupt(chatId).catch(() => undefined)
    }
  }

  /** Доска ждёт GitHub или свободного агента. */
  private wait(card: Card, detail: string, needsAgent = false): void {
    if (!card.flow) {
      return
    }
    card.flow.step = 'waiting'
    card.flow.detail = detail
    if (needsAgent) {
      card.flow.needsAgent = true
    } else {
      delete card.flow.needsAgent
    }
  }

  /** Доска останавливается и ждёт человека: причина видна на карточке. */
  private stop(card: Card, reason: string): void {
    if (!card.flow) {
      return
    }
    if (card.column === 'ready') {
      card.column = 'review'
    }
    card.flow.step = 'stopped'
    card.flow.stopped = reason
    delete card.flow.detail
    delete card.flow.needsAgent
    delete card.flow.reviewChatId
    this.persist()
    this.changed()
  }

  /** Последний коммит worktree агента задачи; нет worktree — `undefined`. */
  private async localHead(card: Card): Promise<string | undefined> {
    const worktree = card.chatId ? this.services.store.findChat(card.chatId)?.chat.worktree : undefined
    return worktree ? this.services.worktrees.headOf(worktree).catch(() => undefined) : undefined
  }

  /** Задача давно в Done и с доски ушла. */
  private isRetired(issueId: string): boolean {
    const card = this.cards.get(issueId)
    return card?.column === 'done' && Date.now() - (card.doneAt ?? 0) > DONE_VISIBLE_MS
  }

  /**
   * Задача закрыта — её агенты больше не нужны: они останавливаются, а их чаты и worktree
   * удаляются. Работа агента уже в ветке и pull request'е на GitHub.
   */
  private async retireAgent(card: Card): Promise<void> {
    const chatIds = [card.chatId, ...(card.reviewChatIds ?? [])].filter(
      (chatId): chatId is string => chatId !== undefined
    )
    const taskChatId = card.chatId
    delete card.chatId
    delete card.reviewChatIds
    this.persist()
    if (chatIds.length === 0) {
      return
    }
    const { store, conversations, worktrees } = this.services
    const location = taskChatId ? store.findChat(taskChatId) : undefined
    for (const chatId of chatIds) {
      store.removeChat(chatId)
      await conversations.remove(chatId)
    }
    this.services.onProjectsChanged()
    if (location?.chat.worktree) {
      await worktrees
        .remove(card.repositoryPath ?? location.project.path, location.chat.worktree)
        .catch((error) => console.error('Failed to remove the task worktree', error))
    }
  }

  /** Учётная запись репозитория задачи на доске. */
  private accountOf(issue: GitHubIssue): string {
    const repository = this.repositories.find(({ fullName }) => fullName === issue.repository)
    if (!repository) {
      throw new Error('The repository is no longer on the board.')
    }
    return repository.account
  }

  private toBoardIssue(issue: GitHubIssue): BoardIssue {
    const card = this.cards.get(issue.id)
    return {
      ...issue,
      // Пока агента готовят, задача уже не ждёт в очереди — если её оттуда не убрали.
      column:
        this.starting.has(issue.id) && card?.column === 'queue'
          ? 'progress'
          : (card?.column ?? 'backlog'),
      ...(card?.chatId && { chatId: card.chatId }),
      ...(card?.error && { error: card.error }),
      ...(card?.flow && { review: this.toBoardReview(card, card.flow) })
    }
  }

  private toBoardReview(card: Card, flow: Flow): BoardReview {
    return {
      step: flow.step,
      round: flow.round,
      maxRounds: this.services.settings.get().boardMaxRounds,
      reviewed: card.reviewer !== undefined,
      approved: flow.approved,
      ...(flow.detail && { detail: flow.detail }),
      ...(flow.pullRequest && { pullRequestUrl: flow.pullRequest.url }),
      ...(flow.reviewChatId && { reviewChatId: flow.reviewChatId }),
      ...(flow.stopped && { stopped: flow.stopped })
    }
  }

  private persist(): void {
    const data: BoardFile = {
      version: BOARD_VERSION,
      repositories: this.repositories,
      cards: Object.fromEntries(this.cards)
    }
    this.file.write(data)
  }

  private changed(): void {
    this.services.onChange(this.state())
  }

  flush(): Promise<void> {
    this.closed = true
    if (this.pollTimer) {
      clearTimeout(this.pollTimer)
      this.pollTimer = null
    }
    return this.file.flush()
  }
}

/** Чем закончился последний ход агента, если ошибкой: лимит, падение агента. */
function turnError(snapshot: ConversationSnapshot | null): string | null {
  const items = snapshot?.items ?? []
  const answer = items.slice(items.findLastIndex(({ kind }) => kind === 'user') + 1)
  const ending = answer.findLast(({ kind }) => kind === 'assistant' || kind === 'error')
  return ending?.kind === 'error' ? ending.message : null
}

/** Восстанавливает ход проверки из файла: агентов перезапуск не пережил, шаги с ними сбрасываются. */
function restoreFlow(value: Flow): Flow | undefined {
  if (!isReviewStep(value?.step)) {
    return undefined
  }
  const { step, round, approved, stopped, pullRequest, rerunHead } = value
  return {
    step: step === 'stopped' ? step : 'waiting',
    round: Number.isInteger(round) ? round : 0,
    approved: approved === true,
    ...(step === 'stopped' && typeof stopped === 'string' && { stopped }),
    ...(pullRequest && { pullRequest }),
    ...(rerunHead && { rerunHead })
  }
}

/** Последнее сообщение агента в ленте — после последнего сообщения пользователя. */
function lastAnswer(snapshot: ConversationSnapshot | null): string {
  const items = snapshot?.items ?? []
  const answer = items.slice(items.findLastIndex(({ kind }) => kind === 'user') + 1)
  const last = answer.findLast((item) => item.kind === 'assistant')
  return last?.kind === 'assistant' ? last.text : ''
}

function isBoardRepository(value: unknown): value is BoardRepository {
  const { fullName, account } = (value ?? {}) as Partial<BoardRepository>
  return typeof fullName === 'string' && fullName.includes('/') && typeof account === 'string'
}
