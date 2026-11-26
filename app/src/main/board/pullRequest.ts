import { NIT_MARKER } from '../../shared/board'

/**
 * Pull request задачи так, как его видит доска: что с проверками, ветками и замечаниями.
 * Здесь только разбор ответа GitHub и правила «что делать дальше» — без сети, чтобы их можно
 * было проверять отдельно.
 */

/** Запрос полей pull request'а; его вставляет `BoardGitHub` в свой запрос. */
export const PULL_REQUEST_FIELDS = `
  number
  url
  state
  isDraft
  headRefOid
  baseRefName
  mergeable
  mergeStateStatus
  reviewDecision
  commits(last: 1) {
    nodes {
      commit {
        statusCheckRollup {
          contexts(first: 100) {
            nodes {
              __typename
              ... on CheckRun {
                name
                status
                conclusion
                detailsUrl
                checkSuite { workflowRun { databaseId } }
              }
              ... on StatusContext { context state targetUrl }
            }
          }
        }
      }
    }
  }
  reviewThreads(first: 100) {
    nodes {
      id
      isResolved
      path
      line
      comments(first: 1) { nodes { body url } }
    }
  }
`

interface CheckRunNode {
  __typename: 'CheckRun'
  name: string
  status: string
  conclusion: string | null
  detailsUrl: string | null
  checkSuite: { workflowRun: { databaseId: number } | null } | null
}

interface StatusContextNode {
  __typename: 'StatusContext'
  context: string
  state: string
  targetUrl: string | null
}

export interface PullRequestNode {
  number: number
  url: string
  state: 'OPEN' | 'CLOSED' | 'MERGED'
  isDraft: boolean
  headRefOid: string
  baseRefName: string
  mergeable: 'MERGEABLE' | 'CONFLICTING' | 'UNKNOWN'
  mergeStateStatus: string
  reviewDecision: 'APPROVED' | 'CHANGES_REQUESTED' | 'REVIEW_REQUIRED' | null
  commits: {
    nodes: {
      commit: {
        statusCheckRollup: {
          contexts: { nodes: (CheckRunNode | StatusContextNode | null)[] }
        } | null
      }
    }[]
  }
  reviewThreads: {
    nodes: {
      id: string
      isResolved: boolean
      path: string | null
      line: number | null
      comments: { nodes: { body: string; url: string }[] }
    }[]
  }
}

/** Проверка, которая не прошла. */
export interface FailedCheck {
  name: string
  /** Страница проверки; у проверок Actions это запуск, из которого берут лог. */
  url: string | null
  /** Запуск GitHub Actions, который можно перезапустить; у внешних проверок его нет. */
  runId: number | null
}

/** Неразрешённое замечание к коду. */
export interface ReviewThread {
  id: string
  path: string | null
  line: number | null
  url: string
  /** Начало первого комментария. */
  excerpt: string
  /** Замечание с меткой «nit» слиянию не мешает. */
  nit: boolean
}

export interface PullRequestStatus {
  number: number
  url: string
  state: 'open' | 'closed' | 'merged'
  /** Последний коммит ветки pull request'а. */
  headSha: string
  baseBranch: string
  /** Ветка отстала от основной или конфликтует с ней: её сначала подтягивают. */
  outdated: boolean
  checks: { pending: string[]; failed: FailedCheck[] }
  /** Неразрешённые замечания, и блокирующие, и придирки. */
  threads: ReviewThread[]
  changesRequested: boolean
  /** Чего GitHub ещё не знает или что мешает слиянию помимо проверок и замечаний. */
  mergeBlocker: string | null
}

/** Сколько символов замечания идёт в задание агенту: остальное он прочитает сам. */
const EXCERPT_LENGTH = 300

/** Состояния проверок, которые считаются пройденными: пропущенная проверка слиянию не мешает. */
const PASSED_CONCLUSIONS = new Set(['SUCCESS', 'NEUTRAL', 'SKIPPED'])
const PENDING_STATUS_STATES = new Set(['PENDING', 'EXPECTED'])

export function toPullRequestStatus(node: PullRequestNode): PullRequestStatus {
  const pending: string[] = []
  const failed: FailedCheck[] = []
  const contexts = node.commits.nodes[0]?.commit.statusCheckRollup?.contexts.nodes ?? []
  for (const context of contexts) {
    if (context?.__typename === 'CheckRun') {
      if (context.status !== 'COMPLETED') {
        pending.push(context.name)
      } else if (!PASSED_CONCLUSIONS.has(context.conclusion ?? '')) {
        failed.push({
          name: context.name,
          url: context.detailsUrl,
          runId: context.checkSuite?.workflowRun?.databaseId ?? null
        })
      }
    } else if (context?.__typename === 'StatusContext') {
      if (PENDING_STATUS_STATES.has(context.state)) {
        pending.push(context.context)
      } else if (context.state !== 'SUCCESS') {
        failed.push({ name: context.context, url: context.targetUrl, runId: null })
      }
    }
  }
  const threads = node.reviewThreads.nodes
    .filter(({ isResolved }) => !isResolved)
    .map((thread) => {
      const comment = thread.comments.nodes[0]
      const body = comment?.body.trim() ?? ''
      return {
        id: thread.id,
        path: thread.path,
        line: thread.line,
        url: comment?.url ?? node.url,
        excerpt: body.slice(0, EXCERPT_LENGTH),
        nit: body.toLowerCase().startsWith(NIT_MARKER)
      }
    })
  const conflicting = node.mergeable === 'CONFLICTING' || node.mergeStateStatus === 'DIRTY'
  return {
    number: node.number,
    url: node.url,
    state: node.state === 'OPEN' ? 'open' : node.state === 'MERGED' ? 'merged' : 'closed',
    headSha: node.headRefOid,
    baseBranch: node.baseRefName,
    outdated: conflicting || node.mergeStateStatus === 'BEHIND',
    checks: { pending, failed },
    threads,
    changesRequested: node.reviewDecision === 'CHANGES_REQUESTED',
    mergeBlocker: mergeBlocker(node)
  }
}

/**
 * Что мешает слиянию, кроме проверок, замечаний и устаревшей ветки — их доска разбирает раньше.
 * Одобрение человека, которого требует защита ветки (`REVIEW_REQUIRED`), — не помеха: готовое
 * к слиянию ждёт именно человека. `null` — ничего.
 */
function mergeBlocker(node: PullRequestNode): string | null {
  if (node.isDraft) {
    return 'The pull request is a draft'
  }
  switch (node.mergeStateStatus) {
    case 'UNKNOWN':
      return 'GitHub is still computing the merge state'
    case 'BLOCKED':
      return node.reviewDecision === 'REVIEW_REQUIRED' ? null : 'Blocked by the branch rules'
    default:
      return null
  }
}

/** Замечания, которые мешают слиянию: все, кроме придирок. */
export function blockingThreads(status: PullRequestStatus): ReviewThread[] {
  return status.threads.filter(({ nit }) => !nit)
}

/**
 * Pull request готов к слиянию: открыт, ветка свежая и без конфликтов, все проверки прошли,
 * блокирующих замечаний нет, а проверяющий агент — если он назначен — его одобрил.
 */
export function isReadyToMerge(status: PullRequestStatus, reviewApproved: boolean): boolean {
  return (
    status.state === 'open' &&
    !status.outdated &&
    status.checks.pending.length === 0 &&
    status.checks.failed.length === 0 &&
    blockingThreads(status).length === 0 &&
    !status.changesRequested &&
    status.mergeBlocker === null &&
    reviewApproved
  )
}
