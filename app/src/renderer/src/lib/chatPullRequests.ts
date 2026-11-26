import type { BranchPullRequest } from '../../../shared/repository'

/**
 * Как часто перепроверять PR чатов на экране. Ответы main и так кэширует, а новый PR агента
 * замечаем сразу после его хода — таймер нужен для того, что случилось на GitHub без нас.
 */
const REFRESH_INTERVAL_MS = 120_000

/**
 * PR веток, в которых работают чаты сайдбара. Строк чатов много, поэтому запросы, таймер
 * и подписка на фокус окна — одни на всех; спрашиваем только про чаты, строки которых видны.
 */
class ChatPullRequestStore {
  private readonly pullRequests = new Map<string, BranchPullRequest | null>()
  /** Сколько строк показывают чат: перепроверяем только видимые. */
  private readonly watchers = new Map<string, number>()
  private readonly pending = new Set<string>()
  private readonly listeners = new Set<() => void>()
  private timer: ReturnType<typeof setInterval> | undefined
  private unsubscribeBranches: (() => void) | undefined

  subscribe = (listener: () => void): (() => void) => {
    this.listeners.add(listener)
    return () => this.listeners.delete(listener)
  }

  get(chatId: string): BranchPullRequest | null {
    return this.pullRequests.get(chatId) ?? null
  }

  /** Строка чата появилась: узнаём его PR и дальше обновляем, пока строка видна. */
  watch(chatId: string): () => void {
    this.watchers.set(chatId, (this.watchers.get(chatId) ?? 0) + 1)
    this.start()
    void this.refresh(chatId)
    return () => {
      const count = (this.watchers.get(chatId) ?? 1) - 1
      if (count > 0) {
        this.watchers.set(chatId, count)
        return
      }
      this.watchers.delete(chatId)
      if (this.watchers.size === 0) {
        this.stop()
      }
    }
  }

  /** `fresh` — спросить GitHub в обход кэша main: например, агент только что мог создать PR. */
  async refresh(chatId: string, fresh = false): Promise<void> {
    if (this.pending.has(chatId)) {
      return
    }
    this.pending.add(chatId)
    try {
      const pullRequest = await window.atox.repository.chatPullRequest(chatId, fresh)
      if (!samePullRequest(this.pullRequests.get(chatId) ?? null, pullRequest)) {
        this.pullRequests.set(chatId, pullRequest)
        this.listeners.forEach((listener) => listener())
      }
    } catch {
      // Чат удалили, пока шёл запрос, — значка у него и так больше нет.
    } finally {
      this.pending.delete(chatId)
    }
  }

  private refreshWatched = (): void => {
    this.watchers.forEach((_count, chatId) => void this.refresh(chatId))
  }

  private start(): void {
    if (this.timer === undefined) {
      this.timer = setInterval(this.refreshWatched, REFRESH_INTERVAL_MS)
      window.addEventListener('focus', this.refreshWatched)
      // Ветку проекта сменили — в том числе агент в терминале: у неё может быть свой PR.
      this.unsubscribeBranches = window.atox.git.subscribe(this.refreshWatched)
    }
  }

  private stop(): void {
    clearInterval(this.timer)
    this.timer = undefined
    window.removeEventListener('focus', this.refreshWatched)
    this.unsubscribeBranches?.()
    this.unsubscribeBranches = undefined
  }
}

function samePullRequest(left: BranchPullRequest | null, right: BranchPullRequest | null): boolean {
  return (
    left === right ||
    (left !== null &&
      right !== null &&
      left.number === right.number &&
      left.title === right.title &&
      left.url === right.url &&
      left.state === right.state)
  )
}

export const chatPullRequests = new ChatPullRequestStore()
