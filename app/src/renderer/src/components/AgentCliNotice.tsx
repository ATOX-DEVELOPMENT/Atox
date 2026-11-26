import { useReducer, useState } from 'react'
import { CircleAlert, Download, LoaderCircle, X } from 'lucide-react'
import { outdatedMessage, type AgentCliStatus } from '../../../shared/agentCli'
import { findAgent, type AgentId } from '../../../shared/agents'
import { useAgentCli } from '../hooks/useAgentCli'
import { ipcErrorMessage } from '../lib/ipcError'

const { atox } = window

/**
 * Что пользователь попросил больше не показывать: по записи на агента. Помнится и после
 * перезапуска — иначе закрытое уведомление возвращалось бы при каждом открытии Atox.
 */
const DISMISSED_KEY = 'atox.agentCli.dismissed.'

function isDismissed(status: AgentCliStatus): boolean {
  return localStorage.getItem(`${DISMISSED_KEY}${status.agent}`) === dismissKey(status)
}

function dismiss(status: AgentCliStatus): void {
  localStorage.setItem(`${DISMISSED_KEY}${status.agent}`, dismissKey(status))
}

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
  if (status.outdated && !isDismissed(status)) {
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
            dismiss(status)
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

/**
 * На что действует «больше не показывать». Версия ниже нужной Atox — на эту пару версий: вырастет
 * требование — напомним снова. Просто вышел новый выпуск (у Codex они выходят очень часто) — на
 * установленную версию целиком: о следующих выпусках не напоминаем, пока агента не обновят.
 */
function dismissKey({ version, target, targetBasis }: AgentCliStatus): string {
  return targetBasis === 'minimum' ? `${version}:${target}` : `${version}`
}

function tail(output: string): string {
  return output.split('\n').slice(-NOTICE_OUTPUT_LINES).join('\n')
}
