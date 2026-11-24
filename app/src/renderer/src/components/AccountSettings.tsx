import { useEffect, useRef, useState, type KeyboardEvent } from 'react'
import { Pencil, Plus, Trash2 } from 'lucide-react'
import { accountLabel, ACCOUNT_NAME_MAX_LENGTH, type AgentAccount } from '../../../shared/accounts'
import { AGENTS, type AgentId } from '../../../shared/agents'
import { useAgentAccounts } from '../hooks/useAgentAccounts'
import { ipcErrorMessage } from '../lib/ipcError'
import { AgentIcon } from './AgentIcon'

const { atox } = window

/** Что написать под названием аккаунта: почта и тариф, если агент их сообщил. */
function describeAccount({ signedIn, email, plan }: AgentAccount, checked: boolean): string {
  if (signedIn === null) {
    return checked ? 'Couldn’t check the sign-in' : 'Checking…'
  }
  if (!signedIn) {
    return 'Not signed in'
  }
  return [email, plan].filter(Boolean).join(' · ') || 'Signed in'
}

/** Раздел настроек «Accounts»: подписки Claude и Codex, между которыми можно переключаться в чате. */
export function AccountSettings() {
  const accounts = useAgentAccounts()
  const [installed, setInstalled] = useState<AgentId[] | null>(null)
  /** Аккаунт, вход в который идёт в браузере. */
  const [signingIn, setSigningIn] = useState<string | null>(null)
  /** Агент, которому сейчас добавляют аккаунт. */
  const [adding, setAdding] = useState<AgentId | null>(null)
  const [renaming, setRenaming] = useState<string | null>(null)
  const [error, setError] = useState<string | null>(null)
  /** Агентов уже спросили, в какие аккаунты они вошли. */
  const [checked, setChecked] = useState(false)
  /** Человек сам отменил вход: об этом не нужно сообщать как об ошибке. */
  const cancelled = useRef(false)

  useEffect(() => {
    void atox.agents.available().then(setInstalled)
    // Агенты отвечают по нескольку секунд: список появляется сразу, а почты и тарифы — следом.
    void atox.accounts
      .refresh()
      .catch(() => undefined)
      .finally(() => setChecked(true))
  }, [])

  const signIn = async (accountId: string) => {
    cancelled.current = false
    setSigningIn(accountId)
    setError(null)
    try {
      await atox.accounts.signIn(accountId)
    } catch (reason) {
      if (!cancelled.current) {
        setError(`Couldn’t sign in: ${ipcErrorMessage(reason)}`)
      }
    } finally {
      setSigningIn(null)
    }
  }

  const cancelSignIn = (accountId: string) => {
    cancelled.current = true
    void atox.accounts.cancelSignIn(accountId)
  }

  const add = async (agent: AgentId) => {
    setAdding(agent)
    setError(null)
    try {
      const account = await atox.accounts.add(agent)
      await signIn(account.id)
    } catch (reason) {
      setError(`Couldn’t add the account: ${ipcErrorMessage(reason)}`)
    } finally {
      setAdding(null)
    }
  }

  const rename = async (accountId: string, name: string) => {
    setRenaming(null)
    setError(null)
    try {
      await atox.accounts.rename(accountId, name)
    } catch (reason) {
      setError(`Couldn’t rename the account: ${ipcErrorMessage(reason)}`)
    }
  }

  const remove = async (accountId: string) => {
    setError(null)
    try {
      await atox.accounts.remove(accountId)
    } catch (reason) {
      setError(`Couldn’t remove the account: ${ipcErrorMessage(reason)}`)
    }
  }

  if (accounts === null || installed === null) {
    return (
      <div className="settings__group">
        <p className="settings__description">Loading accounts…</p>
      </div>
    )
  }

  const agents = AGENTS.filter(({ id }) => installed.includes(id))
  if (agents.length === 0) {
    return (
      <div className="settings__group">
        <p className="settings__description">
          Install Claude Code or Codex to add accounts. Atox finds them in your PATH.
        </p>
      </div>
    )
  }

  return (
    <div className="settings__group">
      {agents.map(({ id, name }) => (
        <div key={id} className="settings__subgroup">
          <h2 className="settings__subgroup-title account-agent">
            <AgentIcon agent={id} className="account-agent__icon" aria-hidden />
            {name}
          </h2>
          <div className="settings__card">
            {accounts
              .filter(({ agent }) => agent === id)
              .map((account) => (
                <div key={account.id} className="settings__row">
                  <span className="settings__label">
                    {renaming === account.id ? (
                      <AccountNameInput
                        value={account.name}
                        onSubmit={(value) => void rename(account.id, value)}
                        onCancel={() => setRenaming(null)}
                      />
                    ) : (
                      <span>{accountLabel(account)}</span>
                    )}
                    <span className="settings__description">{describeAccount(account, checked)}</span>
                  </span>
                  <span className="account-actions">
                    {signingIn === account.id ? (
                      <>
                        <span className="settings__description">Waiting for the browser…</span>
                        <button
                          type="button"
                          className="settings__button"
                          onClick={() => cancelSignIn(account.id)}
                        >
                          Cancel
                        </button>
                      </>
                    ) : (
                      account.signedIn === false && (
                        <button
                          type="button"
                          className="settings__button"
                          disabled={signingIn !== null}
                          onClick={() => void signIn(account.id)}
                        >
                          Sign in
                        </button>
                      )
                    )}
                    {!account.main && (
                      <>
                        <button
                          type="button"
                          className="icon-button"
                          aria-label={`Rename ${account.name}`}
                          title="Rename"
                          onClick={() => setRenaming(account.id)}
                        >
                          <Pencil className="icon" />
                        </button>
                        <button
                          type="button"
                          className="icon-button"
                          aria-label={`Remove ${account.name}`}
                          title="Remove"
                          onClick={() => void remove(account.id)}
                        >
                          <Trash2 className="icon" />
                        </button>
                      </>
                    )}
                  </span>
                </div>
              ))}
            <div className="settings__row settings__row--compact">
              <button
                type="button"
                className="settings__button settings__button--secondary"
                disabled={adding !== null || signingIn !== null}
                onClick={() => void add(id)}
              >
                <Plus className="icon" />
                Add {name} account
              </button>
            </div>
          </div>
        </div>
      ))}
      <p className="settings__note" role={error ? 'alert' : undefined}>
        {error ??
          'Extra accounts share chats, settings, skills and plugins with the main account — only the login is separate. Switch a chat’s account from its model menu.'}
      </p>
    </div>
  )
}

interface AccountNameInputProps {
  value: string
  onSubmit(value: string): void
  onCancel(): void
}

/** Поле названия аккаунта: Enter или потеря фокуса сохраняют, Esc отменяет. */
function AccountNameInput({ value, onSubmit, onCancel }: AccountNameInputProps) {
  const [draft, setDraft] = useState(value)
  // Закрытие поля тоже снимает фокус: без флага Esc превратился бы в сохранение.
  const finished = useRef(false)

  const finish = (save: boolean) => {
    if (finished.current) {
      return
    }
    finished.current = true
    const trimmed = draft.trim()
    if (save && trimmed && trimmed !== value) {
      onSubmit(trimmed)
    } else {
      onCancel()
    }
  }

  const handleKeyDown = (event: KeyboardEvent<HTMLInputElement>) => {
    if (event.key === 'Enter' || event.key === 'Escape') {
      // Esc принадлежит полю: иначе он закрыл бы и окно настроек.
      event.preventDefault()
      event.stopPropagation()
      finish(event.key === 'Enter')
    }
  }

  return (
    <input
      className="settings__text-input"
      aria-label="Account name"
      value={draft}
      maxLength={ACCOUNT_NAME_MAX_LENGTH}
      autoFocus
      spellCheck={false}
      onFocus={(event) => event.currentTarget.select()}
      onChange={(event) => setDraft(event.target.value)}
      onKeyDown={handleKeyDown}
      onBlur={() => finish(true)}
    />
  )
}
