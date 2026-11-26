import { useReducer, useState } from 'react'
import { CircleAlert, Download, LoaderCircle, X } from 'lucide-react'
import { outdatedMessage, type AgentCliStatus } from '../../../shared/agentCli'
import { findAgent, type AgentId } from '../../../shared/agents'
import { useAgentCli } from '../hooks/useAgentCli'
import { ipcErrorMessage } from '../lib/ipcError'

const { atox } = window

/** Версии, о которых пользователь попросил больше не напоминать, пока окно открыто. */
const dismissedVersions = new Set<string>()

/** Сколько последних строк вывода команды видно в уведомлении над полем ввода. */
const NOTICE_OUTPUT_LINES = 3

interface AgentCliNoticeProps {
  agent: AgentId
}

/**
 * Над полем ввода: программа агента не установлена, устарела, ставится или не поставилась.
 * Чат при этом не блокируется — уведомление только предлагает исправить.
 */
export function AgentCliNotice({ agent }: AgentCliNoticeProps) {
  const status = useAgentCli(agent)
  const [error, setError] = useState<string | null>(null)
  const [, rerender] = useReducer((count: number) => count + 1, 0)
  const name = findAgent(agent)?.cliName ?? agent
  if (!status) {
    return null
  }
  const { action } = status

  const run = (kind: 'install' | 'update') => {
    setError(null)
    atox.agentCli[kind](agent).catch((reason) => setError(ipcErrorMessage(reason)))
  }

  if (action?.state === 'running') {
    const lastLines = tail(action.output)
    return (
      <div className="cli-notice" role="status">
        <LoaderCircle className="icon activity__spinner" aria-hidden />
        <div className="cli-notice__body">
          <span>{action.kind === 'install' ? `Installing ${name}…` : `Updating ${name}…`}</span>
          {lastLines && <pre className="cli-notice__output">{lastLines}</pre>}
        </div>
      </div>
    )
  }
  if (action?.state === 'failed') {
    return (
      <div className="cli-notice cli-notice--error" role="alert">
        <CircleAlert className="icon" aria-hidden />
        <div className="cli-notice__body">
          <span>
            {action.kind === 'install' ? 'Couldn’t install' : 'Couldn’t update'} {name}:{' '}
            {action.error}
          </span>
          {action.output && <pre className="cli-notice__output">{tail(action.output)}</pre>}
        </div>
        <button type="button" className="settings__button" onClick={() => run(action.kind)}>
          Try again
        </button>
        <button
          type="button"
          className="cli-notice__close"
          aria-label="Dismiss"
          title="Dismiss"
          onClick={() => void atox.agentCli.dismiss(agent)}
        >
          <X className="icon" />
        </button>
      </div>
    )
  }
  if (!status.installed) {
    return (
      <div className="cli-notice" role="status">
        <Download className="icon" aria-hidden />
        <div className="cli-notice__body">
          <span>{name} isn’t installed.</span>
          {error && <span className="cli-notice__problem">{error}</span>}
        </div>
        {status.installCommand && (
          <button
            type="button"
            className="settings__button settings__button--primary"
            title={status.installCommand}
            onClick={() => run('install')}
          >
            Install {name}
          </button>
        )}
      </div>
    )
  }
  if (status.outdated && !dismissedVersions.has(dismissKey(status))) {
    return (
      <div className="cli-notice" role="status">
        <CircleAlert className="icon" aria-hidden />
        <div className="cli-notice__body">
          <span>{outdatedMessage(name, status)}</span>
          {error && <span className="cli-notice__problem">{error}</span>}
        </div>
        {status.updateCommand && (
          <button
            type="button"
            className="settings__button settings__button--primary"
            title={status.updateCommand}
            onClick={() => run('update')}
          >
            Update
          </button>
        )}
        <button
          type="button"
          className="cli-notice__close"
          aria-label="Dismiss"
          title="Dismiss"
          onClick={() => {
            dismissedVersions.add(dismissKey(status))
            rerender()
          }}
        >
          <X className="icon" />
        </button>
      </div>
    )
  }
  return null
}

function dismissKey({ agent, version, target }: AgentCliStatus): string {
  return `${agent}:${version}:${target}`
}

function tail(output: string): string {
  return output.split('\n').slice(-NOTICE_OUTPUT_LINES).join('\n')
}
