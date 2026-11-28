import { useState } from 'react'
import { CircleAlert, LoaderCircle } from 'lucide-react'
import { outdatedMessage, type AgentCliStatus } from '../../../shared/agentCli'
import { AGENTS } from '../../../shared/agents'
import { useAgentCli } from '../hooks/useAgentCli'
import { ipcErrorMessage } from '../lib/ipcError'
import { AgentIcon } from './AgentIcon'

const { atox } = window

/** Раздел настроек «Agent CLIs»: установлены ли Claude Code и Codex, их версии, установка и обновление. */
export function AgentCliSettings() {
  return (
    <div className="settings__group">
      <p className="settings__description cli-settings__intro">
        Atox runs the Claude Code and Codex programs installed on your computer, the same ones you
        use in the terminal. Keep them up to date to get the newest models and usage limits.
      </p>
      {AGENTS.map((agent) => (
        <section key={agent.id} className="settings__subgroup" aria-label={agent.cliName}>
          <h3 className="integrations__agent">
            <AgentIcon agent={agent.id} className="integrations__agent-icon" />
            {agent.cliName}
          </h3>
          <AgentCliCard agent={agent.id} name={agent.cliName} />
        </section>
      ))}
    </div>
  )
}

function AgentCliCard({ agent, name }: { agent: (typeof AGENTS)[number]['id']; name: string }) {
  const status = useAgentCli(agent)
  const [error, setError] = useState<string | null>(null)

  if (!status) {
    return (
      <div className="settings__card">
        <div className="settings__row">
          <span className="settings__description">Checking…</span>
        </div>
      </div>
    )
  }

  const { action } = status
  const running = action?.state === 'running'
  const run = (kind: 'install' | 'update') => {
    setError(null)
    atox.agentCli[kind](agent).catch((reason) => setError(ipcErrorMessage(reason)))
  }

  return (
    <div className="settings__card">
      <div className="settings__row">
        <span className="settings__label">
          <span>{headline(name, status)}</span>
          <span className="settings__description">{details(name, status)}</span>
          {error && <span className="cli-notice__problem">{error}</span>}
        </span>
        {running ? (
          <LoaderCircle className="icon activity__spinner" aria-label="In progress" />
        ) : !status.installed ? (
          status.installCommand && (
            <button
              type="button"
              className="settings__button settings__button--primary"
              onClick={() => run('install')}
            >
              Install {name}
            </button>
          )
        ) : (
          status.outdated &&
          status.updateCommand && (
            <button
              type="button"
              className="settings__button settings__button--primary"
              onClick={() => run('update')}
            >
              Update
            </button>
          )
        )}
      </div>
      {action && (
        <div className="settings__row settings__row--stacked">
          <span className="settings__description">
            {action.state === 'failed' && <CircleAlert className="icon cli-settings__failed" />}
            {running
              ? `Running: ${action.command}`
              : `${action.kind === 'install' ? 'Install' : 'Update'} failed: ${action.error}`}
          </span>
          {action.output && <pre className="cli-notice__output cli-settings__output">{action.output}</pre>}
          {action.state === 'failed' && (
            <span className="account-actions">
              <button type="button" className="settings__button" onClick={() => run(action.kind)}>
                Try again
              </button>
              <button
                type="button"
                className="settings__button"
                onClick={() => void atox.agentCli.dismiss(agent)}
              >
                Dismiss
              </button>
            </span>
          )}
        </div>
      )}
    </div>
  )
}

function headline(name: string, status: AgentCliStatus): string {
  if (!status.installed) {
    return `${name} isn’t installed`
  }
  return status.version ? `${name} ${status.version}` : name
}

function details(name: string, status: AgentCliStatus): string {
  if (!status.installed) {
    return status.installCommand
      ? `Atox installs it with: ${status.installCommand}`
      : `Install ${name} and make sure it is in your PATH.`
  }
  if (status.outdated) {
    const manual = status.updateCommand
      ? ''
      : ' Atox doesn’t know how it was installed, so update it the same way you installed it.'
    return `${outdatedMessage(name, status)}.${manual}`
  }
  const location = status.executable ?? ''
  return status.target ? `Up to date · ${location}` : location
}
