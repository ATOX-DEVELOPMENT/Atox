/** Агент, с которым идёт разговор в чате: Atox управляет его CLI через служебный протокол. */
export interface Agent {
  id: string
  name: string
  /** Название программы агента, как в её установщике и справке. */
  cliName: string
  /** Программа агента, которую ищем на компьютере пользователя. */
  program: string
  /** Агент сообщает, из чего состоит контекст разговора: работает `/context`. */
  reportsContext: boolean
}

export const AGENTS = [
  {
    id: 'claude',
    name: 'Claude',
    cliName: 'Claude Code',
    program: 'claude',
    reportsContext: true
  },
  { id: 'codex', name: 'Codex', cliName: 'Codex', program: 'codex', reportsContext: false }
] as const satisfies readonly Agent[]

export type AgentId = (typeof AGENTS)[number]['id']

export const DEFAULT_AGENT_ID: AgentId = 'claude'

export function findAgent(id: string | undefined): (typeof AGENTS)[number] | undefined {
  return AGENTS.find((agent) => agent.id === id)
}

export function isAgentId(id: unknown): id is AgentId {
  return typeof id === 'string' && findAgent(id) !== undefined
}
