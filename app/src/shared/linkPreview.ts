import type { CheckStatus, IssueState, PullRequestState, ReviewDecision } from './repository'

/** PR или issue на GitHub — по ссылке на него. */
export interface GitHubLinkPreview {
  kind: 'github'
  type: 'pull-request' | 'issue'
  /** `owner/name`. */
  repository: string
  number: number
  title: string
  state: PullRequestState | IssueState
  author: string
  /** Проверки CI последнего коммита PR; у issue и без проверок — `null`. */
  checks: CheckStatus
  /** Решение ревьюеров PR; у issue и без ревью — `null`. */
  review: ReviewDecision
}

/** Страница сайта: что она сама о себе пишет. */
export interface PageLinkPreview {
  kind: 'page'
  /** Сайт без `www.`: виден, даже если заголовка у страницы нет. */
  site: string
  title: string
  description?: string
  /** Значок сайта как `data:` URL — окно не ходит за картинками в сеть само. */
  icon?: string
}

/** Карточка ссылки при наведении; `null` — показать нечего, и карточки нет. */
export type LinkPreview = GitHubLinkPreview | PageLinkPreview
