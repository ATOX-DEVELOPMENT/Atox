import { useEffect, useRef, useState } from 'react'
import { ChevronDown, RefreshCw } from 'lucide-react'
import { accountLabel, limitsKey, type AgentAccount } from '../../../shared/accounts'
import { AGENTS, type AgentId } from '../../../shared/agents'
import type { PlanLimitsState } from '../../../shared/planLimits'
import type { TokenCounts } from '../../../shared/tokenSpend'
import { useAgentAccounts } from '../hooks/useAgentAccounts'
import { usePlanLimits } from '../hooks/usePlanLimits'
import { useTokenSpend } from '../hooks/useTokenSpend'
import { formatTokens } from '../lib/conversationText'
import { accountSwatch } from '../lib/accountAppearance'
import { showMenu } from '../lib/menu'
import { formatReset } from '../lib/planLimits'
import { AccountAvatar } from './AccountPicker'
import { AgentIcon } from './AgentIcon'
import { Meter } from './UsageCards'

const { atox } = window

const MINUTE_MS = 60 * 1000

/** Где запоминается, лимиты какого аккаунта агента показаны: выбор живёт между открытиями. */
const SHOWN_ACCOUNT_KEY = 'usage-account:'

function storedAccount(agent: AgentId): string | null {
  return localStorage.getItem(`${SHOWN_ACCOUNT_KEY}${agent}`)
}

function storeAccount(agent: AgentId, accountId: string): void {
  localStorage.setItem(`${SHOWN_ACCOUNT_KEY}${agent}`, accountId)
}

const sinceFormat = new Intl.DateTimeFormat('en-US', { month: 'short', day: 'numeric', year: 'numeric' })

/** «Nov 10, 2026» из дня записи `2026-11-10`. */
function formatSince(day: string): string {
  const [year, month, date] = day.split('-').map(Number)
  return sinceFormat.format(new Date(year, month - 1, date))
}

/** Страница Usage в настройках: лимиты подписки и сколько токенов съел каждый агент. */
export function UsageSettings() {
  const limits = usePlanLimits()
  const accounts = useAgentAccounts()
  const spend = useTokenSpend()
  const [refreshing, setRefreshing] = useState(false)
  // Отсчёт до сброса обновляется раз в минуту, как и в сайдбаре.
  const [now, setNow] = useState(Date.now)
  useEffect(() => {
    const timer = setInterval(() => setNow(Date.now()), MINUTE_MS)
    return () => clearInterval(timer)
  }, [])

  const refresh = async () => {
    setRefreshing(true)
    try {
      await atox.planLimits.refresh()
    } finally {
      setRefreshing(false)
    }
  }

  return (
    <div className="settings__group usage-page">
      <div className="usage-page__header">
        <button
          type="button"
          className="settings__button settings__button--secondary"
          onClick={refresh}
          disabled={refreshing}
          title="Re-read plan limits — use this after signing into a different account."
        >
          <RefreshCw className={`icon${refreshing ? ' usage-page__spin' : ''}`} />
          Refresh limits
        </button>
      </div>
      <div className="usage-page__agents">
        {AGENTS.map(({ id, name }) => (
          <AgentUsage
            key={id}
            agent={id}
            name={name}
            accounts={(accounts ?? []).filter(({ agent }) => agent === id)}
            limits={limits}
            spend={spend?.agents[id]}
            now={now}
          />
        ))}
      </div>
      <p className="usage-page__note">
        {spend?.since
          ? `Tokens are counted from chats in Atox since ${formatSince(spend.since)}. Usage in other apps isn’t included.`
          : 'Tokens are counted from chats in Atox. Usage in other apps isn’t included.'}
      </p>
    </div>
  )
}

interface AgentUsageProps {
  agent: AgentId
  name: string
  /** Аккаунты агента, основной первым; пусто — список ещё не пришёл. */
  accounts: readonly AgentAccount[]
  limits: PlanLimitsState
  spend: { today: TokenCounts; total: TokenCounts } | undefined
  now: number
}

/** Карточка агента: лимиты одного аккаунта — его выбирают в шапке — и траты токенов. */
function AgentUsage({ agent, name, accounts, limits: allLimits, spend, now }: AgentUsageProps) {
  const [chosen, setChosen] = useState(() => storedAccount(agent))
  // Аккаунт, который запомнили, могли удалить: тогда показан основной.
  const shown = accounts.find(({ id }) => id === chosen) ?? accounts.find(({ main }) => main)
  const limits = allLimits[shown && !shown.main ? limitsKey(agent, shown.id) : limitsKey(agent)]?.limits

  const choose = (accountId: string) => {
    setChosen(accountId)
    storeAccount(agent, accountId)
  }

  return (
    <section className="usage-agent" aria-label={`${name} usage`}>
      <header className="usage-agent__header">
        <AgentIcon agent={agent} className="usage-agent__icon" aria-hidden />
        <h3 className="usage-agent__name">{name}</h3>
        {shown && accounts.length > 1 && (
          <UsageAccountPicker accounts={accounts} shown={shown} onChoose={choose} />
        )}
      </header>

      <div className="usage-agent__limits">
        {shown?.signedIn === false ? (
          <p className="usage-card__note">
            Sign in to this account under Settings → Accounts to see its limits.
          </p>
        ) : limits === undefined ? (
          <p className="usage-card__note">Plan limits will appear after the first reply.</p>
        ) : limits.length === 0 ? (
          <p className="usage-card__note">Signed in with an API key, so there are no plan limits.</p>
        ) : (
            <ul className="usage-card__rows">
              {limits.map(({ label, percent, resetsAt }) => (
                <li key={label} className="usage-card__row">
                  <div className="usage-card__line">
                    <span>{label}</span>
                    <span className="usage-card__value">{Math.round(percent)}%</span>
                  </div>
                  <Meter percent={percent} />
                  {resetsAt !== undefined && (
                    <span className="usage-card__note">{formatReset(resetsAt, now)}</span>
                  )}
                </li>
              ))}
            </ul>
        )}
      </div>

      <div className="usage-agent__tokens">
        <TokenTile title="Today" counts={spend?.today} />
        <TokenTile title="All time" counts={spend?.total} />
      </div>
    </section>
  )
}

function TokenTile({ title, counts }: { title: string; counts: TokenCounts | undefined }) {
  const { input, output, cached } = counts ?? { input: 0, output: 0, cached: 0 }
  return (
    <div className="token-tile">
      <span className="token-tile__title">{title}</span>
      {/* Кэш входит в итог: это токены, которые модель реально обработала, — как в счётчиках Claude Code. */}
      <span className="token-tile__total">{formatTokens(input + output + cached)}</span>
      <span className="token-tile__unit">tokens</span>
      <dl className="token-tile__parts">
        <div>
          <dt>In</dt>
          <dd>{formatTokens(input)}</dd>
        </div>
        <div>
          <dt>Out</dt>
          <dd>{formatTokens(output)}</dd>
        </div>
        <div>
          <dt>Cached</dt>
          <dd>{formatTokens(cached)}</dd>
        </div>
      </dl>
    </div>
  )
}

interface UsageAccountPickerProps {
  accounts: readonly AgentAccount[]
  shown: AgentAccount
  onChoose(accountId: string): void
}

/** Выбор аккаунта в шапке карточки: кружок и название, клик — список аккаунтов агента. */
function UsageAccountPicker({ accounts, shown, onChoose }: UsageAccountPickerProps) {
  const buttonRef = useRef<HTMLButtonElement>(null)
  const open = async () => {
    const button = buttonRef.current
    if (!button) {
      return
    }
    const choice = await showMenu(
      accounts.map((account) => ({
        action: account.id,
        label: `${accountLabel(account)}${account.signedIn === false ? ' (signed out)' : ''}`,
        swatch: accountSwatch(account, accounts),
        checked: account.id === shown.id
      })),
      button
    )
    if (choice) {
      onChoose(choice)
    }
  }
  return (
    <button
      ref={buttonRef}
      type="button"
      className="usage-agent__account-picker"
      aria-label={`Show the limits of another account (now ${accountLabel(shown)})`}
      onClick={() => void open()}
    >
      <AccountAvatar account={shown} accounts={accounts} />
      <span className="usage-agent__account-name">{accountLabel(shown)}</span>
      <ChevronDown className="icon usage-agent__account-chevron" />
    </button>
  )
}
