import type { PlanLimit } from './conversation'

/** Последние известные лимиты подписки аккаунта агента. */
export interface AgentPlanLimits {
  /** Окна лимитов, самое короткое первым; пустой список — агент работает не по подписке. */
  limits: PlanLimit[]
  /** Когда лимиты узнали, мс с начала эпохи. */
  updatedAt: number
}

/**
 * Лимиты подписки по аккаунтам: ключ — `limitsKey` (у основного аккаунта это имя агента);
 * аккаунта нет — его лимиты ещё не известны.
 */
export type PlanLimitsState = Partial<Record<string, AgentPlanLimits>>
