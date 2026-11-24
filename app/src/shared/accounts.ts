import type { AgentId } from './agents'

/**
 * Аккаунт агента: подписка, под которой он работает. У каждого агента есть основной аккаунт —
 * тот, под которым агент работает и вне Atox (`~/.claude`, `~/.codex`), — и дополнительные,
 * которые пользователь добавил в Atox. Основной Atox не трогает.
 */
export interface AgentAccount {
  id: string
  agent: AgentId
  /** Название: у основного — «Main», у дополнительных его задаёт пользователь. */
  name: string
  main: boolean
  /** Вошёл ли агент в аккаунт; `null` — ещё не проверено. */
  signedIn: boolean | null
  /** Почта аккаунта, когда агент её сообщил. */
  email?: string
  /** Тариф, например «Max» или «Plus». */
  plan?: string
}

/** Что агент сообщает о вошедшем аккаунте; агент не вошёл — сообщать нечего. */
export interface AccountIdentity {
  email?: string
  plan?: string
}

/** Идентификатор основного аккаунта агента: чат, у которого аккаунт не задан, работает под ним. */
export function mainAccountId(agent: AgentId): string {
  return `main:${agent}`
}

/** Допустимая длина названия, которое пользователь дал аккаунту. */
export const ACCOUNT_NAME_MAX_LENGTH = 40

/**
 * Ключ, под которым хранятся лимиты подписки аккаунта: у основного — имя агента, как и до
 * появления аккаунтов, у дополнительного — агент и идентификатор.
 */
export function limitsKey(agent: AgentId, accountId?: string): string {
  return accountId ? `${agent}:${accountId}` : agent
}
