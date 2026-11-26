import type { BranchPullRequest } from '../shared/repository'
import { BACKGROUND_GIT_ENVIRONMENT, runCommand } from './processes'
import type { RepositoryReader } from './repository'
import type { ShellEnvironment } from './shellEnvironment'

/**
 * Сколько ответ GitHub считается свежим. Сайдбар спрашивает PR при фокусе окна и по таймеру
 * у каждого чата, а чаты одного проекта делят папку — без кэша это был бы `gh` на каждый чат.
 */
const FRESH_MS = 60_000

/** Ветки, в которых PR не бывает: основная ветка репозитория, если git её не назвал. */
const DEFAULT_BRANCHES: ReadonlySet<string> = new Set(['main', 'master'])

interface Entry {
  checkedAt: number
  pullRequest: Promise<BranchPullRequest | null>
}

/** PR веток, в которых работают чаты: папка чата → ветка в ней → её PR на GitHub. */
export class ChatPullRequests {
  private readonly entries = new Map<string, Entry>()

  constructor(
    private readonly shell: ShellEnvironment,
    private readonly repository: RepositoryReader
  ) {}

  /**
   * PR текущей ветки папки; `null` — папка не в ветке (основная ветка, detached HEAD, не git),
   * у ветки нет PR или GitHub недоступен. Ветку читаем каждый раз: её могли сменить.
   */
  async get(
    path: string,
    account: string | undefined,
    fresh = false
  ): Promise<BranchPullRequest | null> {
    const branch = await this.git(path, ['symbolic-ref', '--short', '--quiet', 'HEAD'])
    if (!branch || (await this.isDefaultBranch(path, branch))) {
      return null
    }
    const key = [path, branch, account ?? ''].join('\0')
    const cached = this.entries.get(key)
    if (cached && !fresh && Date.now() - cached.checkedAt < FRESH_MS) {
      return cached.pullRequest
    }
    const pullRequest = this.repository.branchPullRequest(path, branch, account)
    this.entries.set(key, { checkedAt: Date.now(), pullRequest })
    return pullRequest
  }

  /** Основная ветка — та, на которую указывает `origin/HEAD`; без неё — main или master. */
  private async isDefaultBranch(path: string, branch: string): Promise<boolean> {
    const remoteHead = await this.git(path, [
      'symbolic-ref',
      '--short',
      '--quiet',
      'refs/remotes/origin/HEAD'
    ])
    return remoteHead ? remoteHead === `origin/${branch}` : DEFAULT_BRANCHES.has(branch)
  }

  /** Вывод git в папке; `null` — команда не удалась или ничего не вывела. */
  private async git(path: string, args: string[]): Promise<string | null> {
    try {
      const env = { ...(await this.shell.get()), ...BACKGROUND_GIT_ENVIRONMENT }
      return (await runCommand('git', args, { cwd: path, env })).trim() || null
    } catch {
      return null
    }
  }
}
