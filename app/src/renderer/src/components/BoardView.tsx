import { useEffect, useMemo, useState, type MouseEvent } from 'react'
import {
  DndContext,
  DragOverlay,
  PointerSensor,
  pointerWithin,
  useDraggable,
  useDroppable,
  useSensor,
  useSensors,
  type DragEndEvent,
  type DragStartEvent
} from '@dnd-kit/core'
import {
  CircleAlert,
  CircleCheck,
  ExternalLink,
  FolderGit2,
  MessageSquare,
  Play,
  RefreshCw,
  Search,
  X
} from 'lucide-react'
import {
  BOARD_COLUMNS,
  isReviewAgentStep,
  type BoardColumn,
  type BoardIssue,
  type ReviewStep
} from '../../../shared/board'
import { useChatActivity } from '../hooks/ChatActivityContext'
import { useSettings } from '../hooks/SettingsContext'
import { useBoard } from '../hooks/useBoard'
import { ASSIGNEE_LABELS, matchesAssignee, type AssigneeFilter } from '../lib/assignee'
import { showMenu, type MenuItem } from '../lib/menu'
import { githubAvatarUrl } from '../lib/github'
import { formatRelativeTime } from '../lib/relativeTime'
import { BoardRepositoryPicker } from './BoardRepositoryPicker'
import { ChatStatus } from './ChatStatus'
import { FilterButton } from './FilterButton'
import { GitHubMark } from './GitHubMark'
import { StartTaskDialog } from './StartTaskDialog'

/** Сдвиг курсора, после которого нажатие на карточку — перетаскивание, а не клик. */
const DRAG_ACTIVATION_DISTANCE_PX = 6

/** Сколько аватаров исполнителей помещается на карточке. */
const MAX_ASSIGNEE_AVATARS = 3

/** Сколько карточек колонка показывает сразу и добавляет по «Show more»: бэклог бывает в сотни задач. */
const COLUMN_PAGE_SIZE = 50

/** Как часто обновлять «synced 2 min ago» в шапке. */
const CLOCK_TICK_MS = 30_000

const COLUMN_INFO: Record<BoardColumn, { title: string; hint: string }> = {
  backlog: { title: 'Backlog', hint: 'No open issues' },
  queue: { title: 'Queue', hint: 'Drop tasks for agents' },
  progress: { title: 'In progress', hint: 'Agents at work show up here' },
  review: { title: 'Review', hint: 'Pull requests being reviewed and fixed' },
  ready: { title: 'Ready', hint: 'Checked and clean, waiting for you to merge' },
  done: { title: 'Done', hint: 'Merged tasks leave the board after a day' }
}

/** Что агент делает на каждом шаге проверки: подпись на карточке. */
const REVIEW_STEP_LABELS: Record<ReviewStep, string> = {
  waiting: 'Waiting for GitHub',
  reviewing: 'Reviewing',
  'fixing-review': 'Fixing review',
  'fixing-checks': 'Fixing CI',
  'fixing-conflicts': 'Fixing conflicts',
  'fixing-comments': 'Fixing comments',
  stopped: 'Needs you'
}

/** Пункт меню фильтра «все». */
const ALL = '*'

interface BoardViewProps {
  onOpenChat(chatId: string): void
  onClose(): void
}

/** Доска задач: issue выбранных репозиториев GitHub по колонкам, очередь задач для агентов. */
export function BoardView({ onOpenChat, onClose }: BoardViewProps) {
  const { state, refresh, move } = useBoard()
  const { boardMaxAgents } = useSettings()
  const [pickerOpen, setPickerOpen] = useState(false)
  const [query, setQuery] = useState('')
  const [owner, setOwner] = useState<string>(ALL)
  const [repository, setRepository] = useState<string>(ALL)
  const [assignee, setAssignee] = useState<AssigneeFilter>('anyone')
  /** Логины учётных записей `gh` пользователя — «мои» задачи назначены на одну из них. */
  const [myLogins, setMyLogins] = useState<ReadonlySet<string>>(new Set())
  const [dragged, setDragged] = useState<BoardIssue | null>(null)
  const now = useClock()
  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: DRAG_ACTIVATION_DISTANCE_PX } })
  )

  useEffect(() => {
    void window.atox.github
      .accounts()
      .then((accounts) => setMyLogins(new Set(accounts.map(({ login }) => login.toLowerCase()))))
  }, [])

  useEffect(() => {
    // Esc, который уже обработало поле или окно выбора репозиториев, страницу не закрывает.
    const closeOnEscape = (event: globalThis.KeyboardEvent) => {
      if (event.key === 'Escape' && !event.defaultPrevented) {
        onClose()
      }
    }
    window.addEventListener('keydown', closeOnEscape)
    return () => window.removeEventListener('keydown', closeOnEscape)
  }, [onClose])

  const issues = state?.issues ?? []
  const owners = useMemo(() => [...new Set(issues.map((issue) => issue.owner))].sort(), [issues])
  const repositories = useMemo(
    () =>
      [...new Set(state?.repositories.map(({ fullName }) => fullName) ?? [])]
        .filter((name) => owner === ALL || name.startsWith(`${owner}/`))
        .sort(),
    [state?.repositories, owner]
  )
  const visible = useMemo(() => {
    const needle = query.trim().toLowerCase()
    return issues.filter(
      (issue) =>
        (owner === ALL || issue.owner === owner) &&
        (repository === ALL || issue.repository === repository) &&
        matchesAssignee(issue.assignees, assignee, myLogins) &&
        (!needle ||
          issue.title.toLowerCase().includes(needle) ||
          `#${issue.number}`.includes(needle) ||
          issue.repository.toLowerCase().includes(needle))
    )
  }, [issues, owner, repository, assignee, myLogins, query])
  // Проверяющие и исправляющие агенты тоже занимают места из лимита.
  const working = issues.filter(
    (issue) =>
      issue.column === 'progress' || (issue.review && isReviewAgentStep(issue.review.step))
  ).length
  /** Задача, которую сейчас отдают агенту: окно выбора агента и сообщения. */
  const [starting, setStarting] = useState<BoardIssue | null>(null)

  /**
   * Перенос задачи. В очередь или в работу из других колонок она уходит через окно запуска:
   * там выбирают агента, модель и сообщение ему. Между очередью и работой — сразу.
   */
  const requestMove = (issueId: string, column: BoardColumn) => {
    const issue = issues.find(({ id }) => id === issueId)
    if (!issue || issue.column === column) {
      return
    }
    const launches = column === 'queue' || column === 'progress'
    const alreadyLaunched = issue.column === 'queue' || issue.column === 'progress'
    if (launches && !alreadyLaunched) {
      setStarting(issue)
    } else {
      move(issueId, column)
    }
  }

  const chooseOwner = async (anchor: Element) => {
    const choice = await showMenu<string>(
      [
        { action: ALL, label: 'All organizations', checked: owner === ALL },
        { type: 'separator' },
        ...owners.map((name) => ({ action: name, label: name, checked: owner === name }))
      ],
      anchor
    )
    if (choice !== null) {
      setOwner(choice)
      setRepository(ALL)
    }
  }

  const chooseRepository = async (anchor: Element) => {
    const choice = await showMenu<string>(
      [
        { action: ALL, label: 'All repositories', checked: repository === ALL },
        { type: 'separator' },
        ...repositories.map((name) => ({ action: name, label: name, checked: repository === name }))
      ],
      anchor
    )
    if (choice !== null) {
      setRepository(choice)
    }
  }

  const chooseAssignee = async (anchor: Element) => {
    const choice = await showMenu<AssigneeFilter>(
      (Object.keys(ASSIGNEE_LABELS) as AssigneeFilter[]).map((id) => ({
        action: id,
        label: id === 'me' ? 'Assigned to me' : ASSIGNEE_LABELS[id],
        checked: assignee === id
      })),
      anchor
    )
    if (choice !== null) {
      setAssignee(choice)
    }
  }

  const handleDragStart = ({ active }: DragStartEvent) =>
    setDragged(issues.find(({ id }) => id === active.id) ?? null)

  const handleDragEnd = ({ active, over }: DragEndEvent) => {
    setDragged(null)
    const issue = issues.find(({ id }) => id === active.id)
    const column = over?.id
    if (issue && typeof column === 'string' && column !== issue.column) {
      requestMove(issue.id, column as BoardColumn)
    }
  }

  const hasRepositories = (state?.repositories.length ?? 0) > 0

  return (
    <section className="board" aria-labelledby="board-title">
      <header className="board__header">
        <div className="board__heading">
          <h1 id="board-title" className="board__title">
            Board
          </h1>
          <p className="board__subtitle" aria-live="polite">
            {describeSync(state, now)}
          </p>
        </div>
        <div className="board__actions">
          {hasRepositories && (
            <span className="board__agents" title="Change the limit in Settings → Board">
              {boardMaxAgents === null
                ? `${working} ${working === 1 ? 'agent' : 'agents'} working`
                : `${working} of ${boardMaxAgents} agents working`}
            </span>
          )}
          {hasRepositories && (
            <button
              type="button"
              className="board__button"
              disabled={state?.syncing}
              onClick={refresh}
            >
              <RefreshCw className="board__button-icon" data-spinning={state?.syncing} />
              Refresh
            </button>
          )}
          <button type="button" className="board__button" onClick={() => setPickerOpen(true)}>
            <FolderGit2 className="board__button-icon" />
            Repositories
            {hasRepositories && <span className="board__count">{state?.repositories.length}</span>}
          </button>
          <button type="button" className="icon-button" aria-label="Close" onClick={onClose}>
            <X className="icon" />
          </button>
        </div>
      </header>

      {state && !hasRepositories ? (
        <div className="board__empty">
          <GitHubMark className="board__empty-icon" />
          <h2 className="board__empty-title">Pick repositories for your board</h2>
          <p className="board__empty-text">
            Their open issues become tasks. Move a task to Queue, and an agent starts working on it
            in its own git worktree, then opens a pull request.
          </p>
          <button
            type="button"
            className="settings__button settings__button--primary board__empty-button"
            onClick={() => setPickerOpen(true)}
          >
            Choose Repositories
          </button>
        </div>
      ) : (
        <>
          <div className="board__toolbar">
            <label className="board__search">
              <Search className="board__search-icon" />
              <input
                type="search"
                placeholder="Search tasks"
                value={query}
                spellCheck={false}
                onChange={(event) => setQuery(event.target.value)}
                onKeyDown={(event) => {
                  if (event.key === 'Escape' && query) {
                    event.preventDefault()
                    setQuery('')
                  }
                }}
              />
            </label>
            <FilterButton
              label="Organization"
              value={owner === ALL ? 'All' : owner}
              onClick={(event) => void chooseOwner(event.currentTarget)}
            />
            <FilterButton
              label="Repository"
              value={repository === ALL ? 'All' : repository.split('/')[1]!}
              onClick={(event) => void chooseRepository(event.currentTarget)}
            />
            <FilterButton
              label="Assignee"
              value={ASSIGNEE_LABELS[assignee]}
              onClick={(event) => void chooseAssignee(event.currentTarget)}
            />
          </div>

          <DndContext
            sensors={sensors}
            collisionDetection={pointerWithin}
            onDragStart={handleDragStart}
            onDragEnd={handleDragEnd}
            onDragCancel={() => setDragged(null)}
          >
            <div className="board__columns">
              {BOARD_COLUMNS.map((column) => (
                <Column
                  key={column}
                  column={column}
                  issues={visible.filter((issue) => issue.column === column)}
                  loading={state === null || (state.syncedAt === null && state.syncing)}
                  onMove={requestMove}
                  onOpenChat={onOpenChat}
                />
              ))}
            </div>
            <DragOverlay dropAnimation={null}>
              {dragged && <CardContent issue={dragged} overlay />}
            </DragOverlay>
          </DndContext>
        </>
      )}

      {starting && (
        <StartTaskDialog
          issue={starting}
          foreignAuthor={
            starting.author !== null && !myLogins.has(starting.author.toLowerCase())
          }
          working={working}
          limit={boardMaxAgents}
          onClose={() => setStarting(null)}
          onStart={(start) => {
            setStarting(null)
            move(starting.id, 'queue', start)
          }}
        />
      )}

      {pickerOpen && state && (
        <BoardRepositoryPicker
          selected={state.repositories}
          onClose={() => setPickerOpen(false)}
          onSave={(next) => {
            setPickerOpen(false)
            void window.atox.board.setRepositories(next)
          }}
        />
      )}
    </section>
  )
}

interface ColumnProps {
  column: BoardColumn
  issues: BoardIssue[]
  loading: boolean
  onMove(issueId: string, column: BoardColumn): void
  onOpenChat(chatId: string): void
}

function Column({ column, issues, loading, onMove, onOpenChat }: ColumnProps) {
  const { setNodeRef, isOver } = useDroppable({ id: column })
  const { title, hint } = COLUMN_INFO[column]
  const [limit, setLimit] = useState(COLUMN_PAGE_SIZE)
  return (
    <section
      ref={setNodeRef}
      className="board-column"
      data-column={column}
      data-over={isOver}
      aria-label={title}
    >
      <header className="board-column__header">
        <span className="board-column__dot" />
        <h2 className="board-column__title">{title}</h2>
        <span className="board-column__count">{issues.length}</span>
      </header>
      <ul className="board-column__cards">
        {issues.length === 0 && (
          <li className="board-column__hint">{loading ? 'Loading tasks…' : hint}</li>
        )}
        {issues.slice(0, limit).map((issue) => (
          <Card key={issue.id} issue={issue} onMove={onMove} onOpenChat={onOpenChat} />
        ))}
        {issues.length > limit && (
          <li className="board-column__more">
            <button
              type="button"
              className="board__button"
              onClick={() => setLimit((current) => current + COLUMN_PAGE_SIZE)}
            >
              Show more ({issues.length - limit})
            </button>
          </li>
        )}
      </ul>
    </section>
  )
}

interface CardProps {
  issue: BoardIssue
  onMove(issueId: string, column: BoardColumn): void
  onOpenChat(chatId: string): void
}

function Card({ issue, onMove, onOpenChat }: CardProps) {
  const { setNodeRef, listeners, attributes, isDragging } = useDraggable({ id: issue.id })

  // Пока задачу проверяют, открывается чат проверяющего, иначе — чат агента задачи.
  const chatId = issue.review?.reviewChatId ?? issue.chatId
  const open = () => (chatId ? onOpenChat(chatId) : window.open(issue.url))

  const openMenu = async (event: MouseEvent) => {
    event.preventDefault()
    const items: MenuItem<string>[] = [
      ...(chatId ? [{ action: 'chat', label: 'Open Chat', icon: <MessageSquare /> } as const] : []),
      ...(issue.review?.pullRequestUrl
        ? [{ action: 'pull', label: 'Open Pull Request', icon: <ExternalLink /> } as const]
        : []),
      { action: 'github', label: 'Open Issue on GitHub', icon: <ExternalLink /> },
      { type: 'separator' },
      {
        type: 'submenu',
        label: 'Move to',
        items: BOARD_COLUMNS.map((column) => ({
          action: `move:${column}`,
          label: COLUMN_INFO[column].title,
          checked: issue.column === column
        }))
      }
    ]
    const action = await showMenu(items, event)
    if (action === 'chat' && chatId) {
      onOpenChat(chatId)
    } else if (action === 'pull' && issue.review?.pullRequestUrl) {
      window.open(issue.review.pullRequestUrl)
    } else if (action === 'github') {
      window.open(issue.url)
    } else if (action?.startsWith('move:')) {
      const column = action.slice('move:'.length) as BoardColumn
      if (column !== issue.column) {
        onMove(issue.id, column)
      }
    }
  }

  return (
    <li
      ref={setNodeRef}
      className="board-card"
      data-dragging={isDragging}
      {...attributes}
      {...listeners}
      onClick={open}
      onContextMenu={(event) => void openMenu(event)}
      onKeyDown={(event) => {
        if (event.key === 'Enter') {
          open()
        }
      }}
    >
      <CardContent issue={issue} onQueue={() => onMove(issue.id, 'queue')} />
    </li>
  )
}

function CardContent({
  issue,
  overlay,
  onQueue
}: {
  issue: BoardIssue
  overlay?: boolean
  onQueue?(): void
}) {
  return (
    <div className="board-card__body" data-overlay={overlay}>
      <div className="board-card__meta">
        <img className="board-card__avatar" src={issue.ownerAvatarUrl} alt="" />
        <span className="board-card__repository">{issue.repository.split('/')[1]}</span>
        <span className="board-card__number">#{issue.number}</span>
        {issue.state === 'closed' && <span className="board-card__closed">Closed</span>}
        {issue.assignees.length > 0 && (
          <span className="board-card__assignees" title={issue.assignees.join(', ')}>
            {issue.assignees.slice(0, MAX_ASSIGNEE_AVATARS).map((login) => (
              <img key={login} className="board-card__assignee" src={githubAvatarUrl(login)} alt="" />
            ))}
          </span>
        )}
      </div>
      <p className="board-card__title">{issue.title}</p>
      {issue.labels.length > 0 && (
        <div className="board-card__labels">
          {issue.labels.map(({ name, color }) => (
            <span key={name} className="board-card__label" style={{ '--label-color': color } as never}>
              {name}
            </span>
          ))}
        </div>
      )}
      {(issue.error ?? issue.review?.stopped) && (
        <p className="board-card__error">
          <CircleAlert className="board-card__error-icon" />
          {issue.error ?? issue.review?.stopped}
        </p>
      )}
      <CardFooter issue={issue} onQueue={onQueue} />
    </div>
  )
}

function CardFooter({ issue, onQueue }: { issue: BoardIssue; onQueue?(): void }) {
  if (issue.review && (issue.column === 'review' || issue.column === 'ready')) {
    return <ReviewStatus issue={issue} review={issue.review} />
  }
  if (issue.chatId && (issue.column === 'progress' || issue.column === 'review')) {
    return <AgentStatus chatId={issue.chatId} column={issue.column} />
  }
  if (issue.column === 'progress') {
    return (
      <div className="board-card__footer">
        <span className="board-card__status">Preparing the worktree…</span>
      </div>
    )
  }
  if (issue.column === 'backlog' && onQueue) {
    return (
      <div className="board-card__footer board-card__footer--hover">
        <button
          type="button"
          className="board-card__action"
          // Кнопка не начинает перетаскивание и не открывает задачу.
          onPointerDown={(event) => event.stopPropagation()}
          onClick={(event) => {
            event.stopPropagation()
            onQueue()
          }}
        >
          <Play className="board-card__action-icon" />
          Start agent…
        </button>
      </div>
    )
  }
  return null
}

function AgentStatus({ chatId, column }: { chatId: string; column: BoardColumn }) {
  const status = useChatActivity(chatId)
  const label =
    status === 'waiting'
      ? 'Agent needs you'
      : status === 'working'
        ? 'Agent working'
        : column === 'review'
          ? 'Ready for review'
          : 'Agent stopped'
  return (
    <div className="board-card__footer">
      <ChatStatus status={status} />
      <span className="board-card__status" data-waiting={status === 'waiting'}>
        {label}
      </span>
      <span className="board-card__open">
        <MessageSquare className="board-card__open-icon" />
        Chat
      </span>
    </div>
  )
}

/** Строка состояния проверки pull request'а: что делает агент или чего ждёт доска. */
function ReviewStatus({
  issue,
  review
}: {
  issue: BoardIssue
  review: NonNullable<BoardIssue['review']>
}) {
  const agentChatId = review.step === 'reviewing' ? review.reviewChatId : issue.chatId
  const rounds = `${review.round}/${review.maxRounds}`
  const label =
    issue.column === 'ready'
      ? review.reviewed
        ? 'Reviewed, ready to merge'
        : 'Ready to merge'
      : review.step === 'waiting'
        ? (review.detail ?? REVIEW_STEP_LABELS.waiting)
        : review.step === 'stopped'
          ? REVIEW_STEP_LABELS.stopped
          : `${REVIEW_STEP_LABELS[review.step]} · round ${rounds}`
  return (
    <div className="board-card__footer">
      {isReviewAgentStep(review.step) && agentChatId ? (
        <ReviewAgentDot chatId={agentChatId} />
      ) : issue.column === 'ready' ? (
        <CircleCheck className="board-card__ready-icon" />
      ) : (
        <ChatStatus status="idle" />
      )}
      <span className="board-card__status" data-waiting={review.step === 'stopped'}>
        {label}
      </span>
      {issue.chatId && (
        <span className="board-card__open">
          <MessageSquare className="board-card__open-icon" />
          Chat
        </span>
      )}
    </div>
  )
}

function ReviewAgentDot({ chatId }: { chatId: string }) {
  return <ChatStatus status={useChatActivity(chatId)} />
}

function describeSync(state: ReturnType<typeof useBoard>['state'], now: number): string {
  if (!state) {
    return ' '
  }
  if (state.syncing) {
    return 'Syncing with GitHub…'
  }
  if (state.error) {
    return `Couldn’t sync with GitHub: ${state.error}`
  }
  if (state.syncedAt === null) {
    return 'Tasks from your GitHub repositories'
  }
  const ago = formatRelativeTime(state.syncedAt, now)
  return ago === 'now' ? 'GitHub synced just now' : `GitHub synced ${ago} ago`
}

function useClock(): number {
  const [now, setNow] = useState(() => Date.now())
  useEffect(() => {
    const timer = setInterval(() => setNow(Date.now()), CLOCK_TICK_MS)
    return () => clearInterval(timer)
  }, [])
  return now
}
