import {
  CircleCheck,
  CircleDashed,
  CircleDot,
  CircleSlash,
  CircleX,
  GitMerge,
  GitPullRequest,
  GitPullRequestClosed,
  GitPullRequestDraft,
  type LucideIcon
} from 'lucide-react'
import type {
  CheckStatus,
  IssueState,
  PullRequestState,
  ReviewDecision
} from '../../../shared/repository'

/** Цвет значка состояния, как на GitHub: открытое зелёное, смёрдженное фиолетовое и т. д. */
export type GitHubTone = 'open' | 'merged' | 'closed' | 'muted'

export interface GitHubStateLook {
  icon: LucideIcon
  tone: GitHubTone
  label: string
}

export const PULL_REQUEST_LOOK: Record<PullRequestState, GitHubStateLook> = {
  open: { icon: GitPullRequest, tone: 'open', label: 'Open' },
  draft: { icon: GitPullRequestDraft, tone: 'muted', label: 'Draft' },
  merged: { icon: GitMerge, tone: 'merged', label: 'Merged' },
  closed: { icon: GitPullRequestClosed, tone: 'closed', label: 'Closed' }
}

export const ISSUE_LOOK: Record<IssueState, GitHubStateLook> = {
  open: { icon: CircleDot, tone: 'open', label: 'Open' },
  completed: { icon: CircleCheck, tone: 'merged', label: 'Closed' },
  'not-planned': { icon: CircleSlash, tone: 'muted', label: 'Not planned' }
}

export const CHECKS_LOOK: Record<NonNullable<CheckStatus>, { icon: LucideIcon; label: string }> = {
  success: { icon: CircleCheck, label: 'Checks passed' },
  failure: { icon: CircleX, label: 'Checks failed' },
  pending: { icon: CircleDashed, label: 'Checks running' }
}

export const REVIEW_LABEL: Record<NonNullable<ReviewDecision>, string> = {
  approved: 'Approved',
  'changes-requested': 'Changes requested',
  'review-required': 'Review required'
}
