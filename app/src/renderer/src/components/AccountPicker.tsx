import { useMemo, useRef } from 'react'
import { accountLabel, type AgentAccount } from '../../../shared/accounts'
import type { Chat } from '../../../shared/models'
import { useProjectsContext } from '../hooks/ProjectsContext'
import { useAgentAccounts } from '../hooks/useAgentAccounts'
import { accountColorStyle, accountInitial, accountSwatch } from '../lib/accountAppearance'
import { showMenu, type MenuItem } from '../lib/menu'

/** Пункт меню — идентификатор аккаунта; пустой — основной. */
type AccountAction = `account:${string}`

const ACCOUNT_ACTION_PREFIX = 'account:'

/** Кружок с первой буквой аккаунта в его цвете. */
export function AccountAvatar({
  account,
  accounts
}: {
  account: AgentAccount
  accounts: readonly AgentAccount[]
}) {
  return (
    <span className="account-avatar" style={accountColorStyle(account, accounts)} aria-hidden>
      {accountInitial(account)}
    </span>
  )
}

/**
 * Аккаунт чата в поле ввода — цветной кружок с буквой, имя в подсказке; клик — список аккаунтов
 * агента. Виден, только если у агента больше одного аккаунта: с одним выбирать не из чего.
 */
export function AccountPicker({ chat }: { chat: Chat }) {
  const { configureChat } = useProjectsContext()
  const allAccounts = useAgentAccounts()
  const buttonRef = useRef<HTMLButtonElement>(null)
  const accounts = useMemo(
    () => allAccounts?.filter(({ agent }) => agent === chat.agent) ?? [],
    [allAccounts, chat.agent]
  )
  // Аккаунт, которого больше нет, чат уже не использует: он работает под основным.
  const current =
    accounts.find(({ id }) => id === chat.account) ?? accounts.find(({ main }) => main)
  if (accounts.length < 2 || !current) {
    return null
  }

  const openMenu = async () => {
    const button = buttonRef.current
    if (!button) {
      return
    }
    const items = accounts.map((account): MenuItem<AccountAction> => ({
      action: `${ACCOUNT_ACTION_PREFIX}${account.main ? '' : account.id}`,
      label: `${accountLabel(account)}${account.signedIn === false ? ' (signed out)' : ''}`,
      swatch: accountSwatch(account, accounts),
      checked: account.id === current.id
    }))
    const action = await showMenu(items, button)
    if (!action) {
      return
    }
    // Разговор остаётся тем же: следующее сообщение продолжит его под выбранным аккаунтом.
    const account = action.slice(ACCOUNT_ACTION_PREFIX.length)
    await configureChat(chat.id, { account: account || null })
  }

  const signedOut = current.signedIn === false
  const title = `Account: ${accountLabel(current)}${
    signedOut ? ' — signed out, sign in under Settings → Accounts' : ''
  }`

  return (
    <button
      ref={buttonRef}
      type="button"
      className="account-picker"
      title={title}
      aria-label={title}
      onClick={() => void openMenu()}
    >
      <AccountAvatar account={current} accounts={accounts} />
    </button>
  )
}
