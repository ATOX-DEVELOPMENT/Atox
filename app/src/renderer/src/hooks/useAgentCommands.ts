import { useEffect, useState } from 'react'
import type { AgentId } from '../../../shared/agents'
import type { AgentCommand } from '../../../shared/conversation'
import {
  LOCAL_COMMANDS,
  RESERVED_COMMAND_NAMES,
  templateSummary
} from '../../../shared/slashCommands'
import { useSettings } from './SettingsContext'

const { atox } = window

/**
 * Команды для подсказок после «/»: свои команды Atox, шаблоны пользователя и команды агента.
 * Шаблон с тем же именем, что у команды агента, заменяет её: его завели сами. Агента спрашивают,
 * только когда подсказки понадобились, — каждый раз заново: Atox помнит ответ недолго, и так
 * подхватываются новые скиллы и команды. Пока ответ идёт, видны прежние команды.
 */
export function useAgentCommands(
  chatId: string,
  agent: AgentId,
  needed: boolean
): readonly AgentCommand[] {
  const key = `${chatId}\0${agent}`
  const [loaded, setLoaded] = useState<{ key: string; commands: AgentCommand[] } | null>(null)
  const agentCommands = loaded?.key === key ? loaded.commands : null

  useEffect(() => {
    if (!needed) {
      return
    }
    let cancelled = false
    void atox.conversations.commands(chatId).then((commands) => {
      if (!cancelled) {
        setLoaded({ key, commands })
      }
    })
    return () => {
      cancelled = true
    }
  }, [chatId, key, needed])

  const templates = useSettings().promptTemplates.map(
    (template): AgentCommand => ({ name: template.name, description: templateSummary(template) })
  )
  const taken = new Set([...RESERVED_COMMAND_NAMES, ...templates.map(({ name }) => name)])
  return [
    ...LOCAL_COMMANDS,
    ...templates,
    ...(agentCommands ?? []).filter(({ name }) => !taken.has(name))
  ]
}
