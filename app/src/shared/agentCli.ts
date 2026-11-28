import type { AgentId } from './agents'

/** Что делает действие над программой агента. */
export type AgentCliActionKind = 'install' | 'update'

/** Установка или обновление программы агента: идёт, закончилось или не удалось. */
export interface AgentCliAction {
  kind: AgentCliActionKind
  state: 'running' | 'failed'
  /** Команда, которую запустил Atox, — как её набрали бы в терминале. */
  command: string
  /** Последние строки вывода команды. */
  output: string
  /** Почему не удалось. */
  error?: string
}

/**
 * Откуда взята версия, с которой сравнивается установленная: минимум, нужный Atox
 * (`minimum`), или последний выпуск (`latest`).
 */
export type AgentCliTargetBasis = 'minimum' | 'latest'

/** Программа агента на компьютере: установлена ли, не устарела ли и что с ней делает Atox. */
export interface AgentCliStatus {
  agent: AgentId
  installed: boolean
  /** Путь к программе, которую запускает Atox. */
  executable: string | null
  /** Установленная версия; `null` — программа не ответила, какая она. */
  version: string | null
  /** С какой версией сравнивали; `null` — узнать её не удалось (например, нет сети). */
  target: string | null
  targetBasis: AgentCliTargetBasis
  /** Версия ниже целевой. */
  outdated: boolean
  /** Команда кнопки «Install»; `null` — Atox не умеет её ставить. */
  installCommand: string | null
  /** Команда кнопки «Update»; `null` — способ установки неизвестен, обновлять нужно вручную. */
  updateCommand: string | null
  /** Идущее или неудавшееся действие. */
  action: AgentCliAction | null
}

/** Текст о том, что программа агента устарела, — для поля ввода и настроек. */
export function outdatedMessage(agentName: string, status: AgentCliStatus): string {
  const prefix = `${agentName}${status.version ? ` ${status.version}` : ''} is`
  return status.targetBasis === 'minimum'
    ? `${prefix} out of date: limits and newest models need ${status.target}+`
    : `${prefix} out of date: ${status.target} is available with newer models`
}
