import type { CSSProperties } from 'react'
import type { AgentAccount } from '../../../shared/accounts'
import { findProjectColor, type ProjectColor } from '../../../shared/projectColors'
import { colorSchemeQuery } from './colorScheme'

/** Основной аккаунт — нейтральный: цвет выделяет только дополнительные. */
const MAIN_ACCOUNT_COLOR: ProjectColor = 'gray'

/**
 * Цвета дополнительных аккаунтов по порядку, в котором их добавили. Жёлтого нет: белая буква
 * на нём не читается.
 */
const EXTRA_ACCOUNT_COLORS: readonly ProjectColor[] = ['blue', 'purple', 'green', 'orange', 'red']

/** Короткое имя основного аккаунта — для кнопки в поле ввода, где мало места. */
const MAIN_ACCOUNT_SHORT_NAME = 'Main'

function accountColor(account: AgentAccount, accounts: readonly AgentAccount[]): ProjectColor {
  if (account.main) {
    return MAIN_ACCOUNT_COLOR
  }
  const index = accounts
    .filter(({ agent, main }) => agent === account.agent && !main)
    .findIndex(({ id }) => id === account.id)
  return EXTRA_ACCOUNT_COLORS[Math.max(index, 0) % EXTRA_ACCOUNT_COLORS.length]!
}

/** Цвет аккаунта для обеих тем: нужный выбирает CSS. */
export function accountColorStyle(
  account: AgentAccount,
  accounts: readonly AgentAccount[]
): CSSProperties {
  const color = findProjectColor(accountColor(account, accounts))!
  return {
    '--account-color': `light-dark(${color.light}, ${color.dark})`
  } as CSSProperties
}

/** Цвет аккаунта в текущей теме — для кружков меню, которые не читают CSS-переменные. */
export function accountSwatch(account: AgentAccount, accounts: readonly AgentAccount[]): string {
  const color = findProjectColor(accountColor(account, accounts))!
  return colorSchemeQuery.matches ? color.dark : color.light
}

/** Имя аккаунта там, где мало места. */
function accountShortName(account: AgentAccount): string {
  return account.main ? MAIN_ACCOUNT_SHORT_NAME : account.name
}

/** Буква в кружке аккаунта. */
export function accountInitial(account: AgentAccount): string {
  const [first = '?'] = accountShortName(account).trim()
  return first.toLocaleUpperCase()
}
