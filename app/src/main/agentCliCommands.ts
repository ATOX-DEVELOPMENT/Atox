import { dirname, join } from 'node:path'
import type { AgentId } from '../shared/agents'

/** Как программа агента попала на компьютер: от этого зависит, чем её обновлять. */
export type InstallMethod = 'self' | 'npm' | 'homebrew-cask' | 'homebrew-formula' | 'unknown'

/** Команда установки или обновления: что запускать и как это выглядит в терминале. */
export interface CliCommand {
  file: string
  args: string[]
  /** Команда, как её набрали бы в терминале, — для показа пользователю. */
  display: string
}

/** Пакеты агентов в npm: по ним ставятся и обновляются, и по ним узнаётся последняя версия. */
export const NPM_PACKAGES: Record<AgentId, string> = {
  claude: '@anthropic-ai/claude-code',
  codex: '@openai/codex'
}

/** Имена в Homebrew: у Claude Code — cask, у Codex — cask и одноимённая формула. */
const HOMEBREW_NAMES: Record<AgentId, string> = { claude: 'claude-code', codex: 'codex' }

/** Официальный установщик Claude Code: на macOS и Linux — shell-скрипт, на Windows — PowerShell. */
const CLAUDE_INSTALL_SCRIPT_URL = 'https://claude.ai/install.sh'
const CLAUDE_INSTALL_POWERSHELL_URL = 'https://claude.ai/install.ps1'

/** Следы способов установки в пути программы (после разрешения ссылок, с `/` вместо `\`). */
const NPM_MARKER = '/node_modules/'
const HOMEBREW_CASK_MARKER = '/Caskroom/'
const HOMEBREW_FORMULA_MARKER = '/Cellar/'

/**
 * Способ, которым установлена программа агента, по её пути после разрешения ссылок: в PATH
 * установщики кладут ссылку, а настоящий путь говорит, откуда она. Claude Code умеет обновлять
 * себя при любой установке, поэтому для него «неизвестно» — `self`.
 */
export function detectInstallMethod(agent: AgentId, realPath: string): InstallMethod {
  const real = realPath.replaceAll('\\', '/')
  if (real.includes(HOMEBREW_CASK_MARKER)) {
    return 'homebrew-cask'
  }
  if (real.includes(HOMEBREW_FORMULA_MARKER)) {
    return 'homebrew-formula'
  }
  if (real.includes(NPM_MARKER)) {
    return 'npm'
  }
  // Остальное у Codex — например, бинарник, скачанный вручную: чем его обновлять, неизвестно.
  return agent === 'claude' ? 'self' : 'unknown'
}

/**
 * Соседний с программой `npm`: им её и ставили (например, из той же версии node у nvm).
 * `null` — рядом его нет.
 */
export function npmNextTo(
  executable: string,
  exists: (path: string) => boolean,
  windows: boolean
): string | null {
  const sibling = join(dirname(executable), windows ? 'npm.cmd' : 'npm')
  return exists(sibling) ? sibling : null
}

/** Команда обновления; `null` — способ установки неизвестен. */
export function updateCommand(
  agent: AgentId,
  method: InstallMethod,
  executable: string,
  npm: string
): CliCommand | null {
  switch (method) {
    case 'self':
      return { file: executable, args: ['update'], display: `${agent} update` }
    case 'npm': {
      const args = ['install', '-g', `${NPM_PACKAGES[agent]}@latest`]
      return { file: npm, args, display: `npm i -g ${NPM_PACKAGES[agent]}@latest` }
    }
    case 'homebrew-cask':
      return {
        file: 'brew',
        args: ['upgrade', '--cask', HOMEBREW_NAMES[agent]],
        display: `brew upgrade --cask ${HOMEBREW_NAMES[agent]}`
      }
    case 'homebrew-formula':
      return {
        file: 'brew',
        args: ['upgrade', HOMEBREW_NAMES[agent]],
        display: `brew upgrade ${HOMEBREW_NAMES[agent]}`
      }
    case 'unknown':
      return null
  }
}

/**
 * Команда установки. Claude Code ставится официальным установщиком; остальные агенты — через
 * npm, если он есть (`npm` — путь к нему или `null`).
 */
export function installCommand(
  agent: AgentId,
  windows: boolean,
  npm: string | null
): CliCommand | null {
  if (agent === 'claude') {
    return windows
      ? {
          file: 'powershell.exe',
          args: ['-NoProfile', '-ExecutionPolicy', 'Bypass', '-Command', `irm ${CLAUDE_INSTALL_POWERSHELL_URL} | iex`],
          display: `irm ${CLAUDE_INSTALL_POWERSHELL_URL} | iex`
        }
      : {
          file: '/bin/sh',
          args: ['-c', `curl -fsSL ${CLAUDE_INSTALL_SCRIPT_URL} | bash`],
          display: `curl -fsSL ${CLAUDE_INSTALL_SCRIPT_URL} | bash`
        }
  }
  return npm
    ? {
        file: npm,
        args: ['install', '-g', NPM_PACKAGES[agent]],
        display: `npm i -g ${NPM_PACKAGES[agent]}`
      }
    : null
}
