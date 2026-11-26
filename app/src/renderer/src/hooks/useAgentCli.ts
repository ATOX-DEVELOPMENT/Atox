import { useEffect, useSyncExternalStore } from 'react'
import type { AgentCliStatus } from '../../../shared/agentCli'
import type { AgentId } from '../../../shared/agents'

const { atox } = window

/** Состояние программ агентов одно на всё окно; `null` — ещё не пришло. */
let statuses: AgentCliStatus[] | null = null
const listeners = new Set<() => void>()

function setStatuses(next: AgentCliStatus[]): void {
  statuses = next
  listeners.forEach((listener) => listener())
}

function load(): void {
  void atox.agentCli
    .list()
    .then(setStatuses)
    .catch((error) => console.error('Failed to read the agent CLI status', error))
}

// Установка и обновление идут в main: оттуда приходит и ход команды, и итоговое состояние.
atox.agentCli.onChanged(setStatuses)
// Пользователь мог обновить или поставить агента в терминале, пока окно было в фоне.
window.addEventListener('focus', load)
load()

function subscribe(listener: () => void): () => void {
  listeners.add(listener)
  return () => listeners.delete(listener)
}

/** Программа агента: установлена ли, не устарела ли и идёт ли её установка или обновление. */
export function useAgentCli(agent: AgentId): AgentCliStatus | null {
  const all = useSyncExternalStore(subscribe, () => statuses)
  useEffect(() => {
    // Окно, открытое давно, показывает прежнее; свежее состояние спрашиваем при показе.
    load()
  }, [agent])
  return all?.find((status) => status.agent === agent) ?? null
}
