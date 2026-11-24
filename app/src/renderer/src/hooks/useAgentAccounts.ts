import { useEffect, useState } from 'react'
import type { AgentAccount } from '../../../shared/accounts'

const { atox } = window

/**
 * Аккаунты всех агентов; `null` — список ещё не пришёл. Обновляется, как только main узнаёт
 * об изменении: аккаунт добавили, переименовали, удалили или в него вошли.
 */
export function useAgentAccounts(): AgentAccount[] | null {
  const [accounts, setAccounts] = useState<AgentAccount[] | null>(null)

  useEffect(() => {
    let subscribed = true
    const unsubscribe = atox.accounts.onChanged(setAccounts)
    void atox.accounts.list().then((initial) => {
      // Подписка могла принести более свежий список, пока шёл первый запрос.
      if (subscribed) {
        setAccounts((current) => current ?? initial)
      }
    })
    return () => {
      subscribed = false
      unsubscribe()
    }
  }, [])

  return accounts
}
