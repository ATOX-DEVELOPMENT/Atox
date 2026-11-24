import { useEffect, useMemo, useRef } from 'react'
import { ChevronDown, Gauge, UserRound } from 'lucide-react'
import { accountLabel, type AgentAccount } from '../../../shared/accounts'
import { AGENTS, findAgent, isAgentId } from '../../../shared/agents'
import type { AgentCatalog, AgentModel } from '../../../shared/conversation'
import type { Chat } from '../../../shared/models'
import { useProjectsContext } from '../hooks/ProjectsContext'
import { useAgentAccounts } from '../hooks/useAgentAccounts'
import { loadAgentCatalog, useAgentCatalog } from '../hooks/useAgentCatalog'
import { effortLabel } from '../lib/conversationText'
import { getOpenMenu, showMenu, updateMenu, type MenuItem } from '../lib/menu'
import { currentModel, modelConfiguration } from '../lib/modelSelection'
import { AgentIcon } from './AgentIcon'

const { atox } = window

/**
 * Действия меню: `agent:claude`, `model:opus`, `effort:high`, `account:3f9a1c2e`; пустой эффорт —
 * по умолчанию, пустой аккаунт — основной.
 */
type PickerAction = `agent:${string}` | `model:${string}` | `effort:${string}` | `account:${string}`

interface ModelPickerProps {
  chat: Chat
  /** Растёт, когда меню просят открыть без клика — командой `/model` или `/effort`. */
  openRequest: number
}

/** Кнопка «Opus 5.5 High» в поле ввода: меню с агентом, моделью и эффортом. */
export function ModelPicker({ chat, openRequest }: ModelPickerProps) {
  const { configureChat } = useProjectsContext()
  const catalog = useAgentCatalog(chat.agent)
  // Аккаунты агента чата: основной и дополнительные. Меню выбора показывается, если есть из чего.
  const allAccounts = useAgentAccounts()
  const accounts = useMemo(
    () => allAccounts?.filter(({ agent }) => agent === chat.agent) ?? [],
    [allAccounts, chat.agent]
  )
  const buttonRef = useRef<HTMLButtonElement>(null)
  const model = catalog && currentModel(chat, catalog)
  const effort = chat.effort ?? model?.defaultEffort
  // Меню открыто, пока ждёт выбора: пока оно открыто, список моделей может догрузиться.
  const openedMenu = useRef<{ id: number; agents: string[] } | null>(null)
  // Свежие чат и модели для действий, которые доделываются после ожидания.
  const latest = useRef({ chat, catalog, model, accounts })
  latest.current = { chat, catalog, model, accounts }

  const openMenu = async () => {
    const button = buttonRef.current
    if (!button) {
      return
    }
    // Список моделей не загрузился раньше — спрашиваем агента снова, меню обновится само.
    void loadAgentCatalog(chat.agent)
    // Агента можно сменить в любой момент: новый продолжит разговор с того же места.
    const agents = await atox.agents.available()
    const choice = showMenu(buildMenu({ ...latest.current, agents }), button)
    const menu = getOpenMenu()
    openedMenu.current = menu && { id: menu.id, agents }
    const action = await choice
    if (openedMenu.current?.id === menu?.id) {
      openedMenu.current = null
    }
    if (!action) {
      return
    }
    const current = latest.current
    const [kind, value = ''] = splitAction(action)
    if (kind === 'agent' && isAgentId(value)) {
      await configureChat(current.chat.id, { agent: value })
    } else if (kind === 'model' && current.catalog) {
      await configureChat(current.chat.id, modelConfiguration(current.chat, current.catalog, value))
    } else if (kind === 'effort') {
      await configureChat(current.chat.id, { effort: value || null })
    } else if (kind === 'account') {
      // Разговор остаётся тем же: следующее сообщение продолжит его под выбранным аккаунтом.
      await configureChat(current.chat.id, { account: value || null })
    }
  }

  // Список моделей догрузился или сменился агент, пока меню открыто: меню показывает новое.
  useEffect(() => {
    const menu = openedMenu.current
    if (menu) {
      updateMenu(menu.id, buildMenu({ chat, catalog, model, accounts, agents: menu.agents }))
    }
  }, [chat, catalog, model, accounts])

  // Последняя версия openMenu: эффект ниже срабатывает только на новый запрос открыть меню.
  const openMenuRef = useRef(openMenu)
  openMenuRef.current = openMenu
  useEffect(() => {
    if (openRequest > 0) {
      void openMenuRef.current()
    }
  }, [openRequest])

  const agentName = findAgent(chat.agent)?.name ?? chat.agent
  // Дополнительный аккаунт подписан у кнопки: видно, под каким работает чат.
  const extraAccount = accounts.find(({ id }) => id === chat.account)
  const label =
    catalog === undefined
      ? agentName
      : `${model?.name ?? chat.model ?? agentName}${effort ? ` ${effortLabel(effort)}` : ''}`

  return (
    <button
      ref={buttonRef}
      type="button"
      className="model-picker"
      title={extraAccount ? `Choose the model or account (${extraAccount.name})` : 'Choose the model'}
      onClick={() => void openMenu()}
    >
      <AgentIcon agent={chat.agent} className="agent-icon" />
      <span className="model-picker__label">{label}</span>
      {extraAccount && <span className="model-picker__account">{extraAccount.name}</span>}
      <ChevronDown className="icon model-picker__chevron" />
    </button>
  )
}

function splitAction(action: PickerAction): [string, string] {
  const separator = action.indexOf(':')
  return [action.slice(0, separator), action.slice(separator + 1)]
}

interface MenuSource {
  chat: Chat
  catalog: AgentCatalog | null | undefined
  model: AgentModel | null | undefined
  /** Аккаунты агента чата, основной первым. */
  accounts: AgentAccount[]
  /** Установленные агенты; пустой список — выбор агента не показывается. */
  agents: string[]
}

function buildMenu({ chat, catalog, model, accounts, agents }: MenuSource): MenuItem<PickerAction>[] {
  const items: MenuItem<PickerAction>[] = []
  const installed = AGENTS.filter(({ id }) => agents.includes(id))
  if (installed.length > 1) {
    items.push(
      ...installed.map((agent): MenuItem<PickerAction> => ({
        action: `agent:${agent.id}`,
        label: agent.name,
        icon: <AgentIcon agent={agent.id} />,
        checked: agent.id === chat.agent
      })),
      { type: 'separator' }
    )
  }

  if (accounts.length > 1) {
    items.push(
      {
        type: 'submenu',
        label: 'Account',
        icon: <UserRound />,
        items: accounts.map((account): MenuItem<PickerAction> => ({
          action: `account:${account.main ? '' : account.id}`,
          label: `${accountLabel(account)}${account.email ? ` · ${account.email}` : ''}`,
          checked: account.main ? !chat.account : chat.account === account.id
        }))
      },
      { type: 'separator' }
    )
  }

  if (!catalog) {
    items.push({
      action: 'model:',
      label: catalog === null ? 'Models are unavailable' : 'Loading models…',
      enabled: false
    })
    return items
  }

  const modelItem = (option: AgentModel): MenuItem<PickerAction> => ({
    action: `model:${option.id}`,
    label: option.name,
    checked: option.id === model?.id
  })
  const secondary = catalog.models.filter((option) => option.secondary)
  items.push(...catalog.models.filter((option) => !option.secondary).map(modelItem))
  if (secondary.length > 0) {
    items.push({
      type: 'submenu',
      label: 'Other Models',
      items: secondary.map(modelItem)
    })
  }

  if (model && model.efforts.length > 0) {
    const defaultLabel = model.defaultEffort
      ? `Default (${effortLabel(model.defaultEffort)})`
      : 'Default'
    items.push(
      { type: 'separator' },
      {
        type: 'submenu',
        label: 'Effort',
        icon: <Gauge />,
        items: [
          {
            action: 'effort:',
            label: defaultLabel,
            checked: chat.effort === undefined
          },
          { type: 'separator' },
          ...model.efforts.map((level): MenuItem<PickerAction> => ({
            action: `effort:${level}`,
            label: effortLabel(level),
            checked: level === chat.effort
          }))
        ]
      }
    )
  }
  return items
}
