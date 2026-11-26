import {
  memo,
  useEffect,
  useId,
  useMemo,
  useRef,
  useState,
  useSyncExternalStore,
  type MouseEvent
} from 'react'
import {
  Archive,
  ChevronDown,
  Columns2,
  GitFork,
  LayoutDashboard,
  Pencil,
  Trash2
} from 'lucide-react'
import { findAgent } from '../../../shared/agents'
import type { Chat } from '../../../shared/models'
import { isCommandClick } from '../../../shared/shortcuts'
import { useCanvasNavigation, useChatCanvases } from '../hooks/CanvasesContext'
import { useChatActivity } from '../hooks/ChatActivityContext'
import { useProjectActions } from '../hooks/ProjectsContext'
import { chatPullRequests } from '../lib/chatPullRequests'
import { PULL_REQUEST_LOOK } from '../lib/githubStates'
import { showMenu } from '../lib/menu'
import { AgentIcon } from './AgentIcon'
import { ChatCanvasRow } from './canvas/ChatCanvasRow'
import { ChatStatus } from './ChatStatus'
import { HoverHint, useHoverHint } from './HoverHint'
import { InlineRename } from './InlineRename'
import { useSortableItem } from './SortableList'

interface ChatItemProps {
  chat: Chat
  /** Помощники, которых запустил агент этого чата; показываются под ним. */
  workers: Chat[]
  /** Чат в фокусе, если это чат карточки или его помощник; иначе `null`. */
  activeChatId: string | null
  /** Чаты на экране, если среди них есть чаты карточки; иначе пусто. */
  visibleChatIds: readonly string[]
  /** В проекте этого чата есть чат в фокусе — рядом с ним можно открыть другой. */
  canOpenBesideActive: boolean
}

/**
 * Чат в списке проекта. Если его агент запустил помощников, чат становится карточкой:
 * под ним сворачиваемая строка «N agents» и компактные строки помощников.
 * Перетаскивается вся карточка целиком.
 */
export const ChatItem = memo(function ChatItem({
  chat,
  workers,
  activeChatId,
  visibleChatIds,
  canOpenBesideActive
}: ChatItemProps) {
  const [renaming, setRenaming] = useState(false)
  const [workersExpanded, setWorkersExpanded] = useState(true)
  const workersId = useId()
  const { itemProps, handleProps } = useSortableItem(chat.id, renaming)
  const hasWorkers = workers.length > 0
  const workerChatIds = useMemo(() => workers.map(({ id }) => id), [workers])
  const rowSelection = (rowChatId: string): RowSelection => {
    const visible = visibleChatIds.includes(rowChatId)
    return {
      active: rowChatId === activeChatId,
      visible,
      canOpenBeside: canOpenBesideActive && !visible
    }
  }

  return (
    <li className="chat-group" data-has-workers={hasWorkers} {...itemProps}>
      <ChatRow
        chat={chat}
        {...rowSelection(chat.id)}
        workerChatIds={workerChatIds}
        renaming={renaming}
        onRenamingChange={setRenaming}
        dragHandleProps={handleProps}
      />
      <ChatCanvasRow chatId={chat.id} />
      {hasWorkers && (
        <>
          <button
            type="button"
            className="chat-workers__toggle"
            aria-expanded={workersExpanded}
            aria-controls={workersId}
            onClick={() => setWorkersExpanded((value) => !value)}
          >
            {describeChildren(workers)}
            <ChevronDown className="icon" aria-hidden />
          </button>
          {/* Свёрнутые помощники остаются в DOM, чтобы список плавно раскрывался. */}
          <div
            id={workersId}
            className="chat-workers"
            data-expanded={workersExpanded}
            inert={!workersExpanded}
          >
            <ul>
              {workers.map((worker) => (
                <WorkerItem key={worker.id} chat={worker} {...rowSelection(worker.id)} />
              ))}
            </ul>
          </div>
        </>
      )}
    </li>
  )
})

/** Как строка чата выглядит относительно экрана; считается в карточке, а не в каждой строке. */
interface RowSelection {
  /** Чат в фокусе. */
  active: boolean
  /** Чат на экране (в фокусе или рядом). */
  visible: boolean
  /** В меню есть «Open to the Side». */
  canOpenBeside: boolean
}

function WorkerItem({ chat, ...selection }: { chat: Chat } & RowSelection) {
  const [renaming, setRenaming] = useState(false)
  return (
    <li>
      <ChatRow
        chat={chat}
        {...selection}
        compact
        renaming={renaming}
        onRenamingChange={setRenaming}
      />
      <ChatCanvasRow chatId={chat.id} compact />
    </li>
  )
}

interface ChatRowProps extends RowSelection {
  chat: Chat
  /** Помощники чата: пока работает любой из них, индикатор чата показывает работу. */
  workerChatIds?: readonly string[]
  /** Строка помощника: в одну строку, со значком агента вместо индикатора и ветки. */
  compact?: boolean
  renaming: boolean
  onRenamingChange(renaming: boolean): void
  /** Обработчики перетаскивания: строку чата верхнего уровня можно тянуть. */
  dragHandleProps?: ReturnType<typeof useSortableItem>['handleProps']
}

function ChatRow({
  chat,
  active,
  visible,
  canOpenBeside,
  workerChatIds,
  compact = false,
  renaming,
  onRenamingChange,
  dragHandleProps
}: ChatRowProps) {
  // Только действия: строка перерисовывается, лишь когда меняются её собственные данные.
  const { selectChat, openChatBeside, renameChat, forkChat, archiveChat, removeChat } =
    useProjectActions()
  // Пункт меню открывает холст чата или создаёт его.
  const hasCanvas = useChatCanvases(chat.id).length > 0
  const { openChatCanvas } = useCanvasNavigation()

  const openContextMenu = async (event: MouseEvent) => {
    event.preventDefault()
    const action = await showMenu(
      [
        ...(canOpenBeside
          ? [
              {
                action: 'open-beside' as const,
                label: 'Open to the Side',
                icon: <Columns2 />
              }
            ]
          : []),
        {
          action: 'canvas',
          label: hasCanvas ? 'Open canvas' : 'Create canvas',
          icon: <LayoutDashboard />
        },
        { type: 'separator' },
        { action: 'rename', label: 'Rename', icon: <Pencil /> },
        { action: 'fork', label: 'Fork chat', icon: <GitFork /> },
        { type: 'separator' },
        { action: 'archive', label: 'Archive chat', icon: <Archive /> },
        { action: 'remove', label: 'Delete chat', icon: <Trash2 />, destructive: true }
      ],
      event
    )
    if (action === 'open-beside') {
      openChatBeside(chat.id)
    } else if (action === 'canvas') {
      openChatCanvas(chat.id)
    } else if (action === 'rename') {
      onRenamingChange(true)
    } else if (action === 'fork') {
      void forkChat(chat.id)
    } else if (action === 'archive') {
      void archiveChat(chat.id)
    } else if (action === 'remove') {
      void removeChat(chat.id)
    }
  }

  const title = renaming ? (
    <InlineRename
      value={chat.title}
      label="Chat name"
      onSubmit={(value) => {
        onRenamingChange(false)
        void renameChat(chat.id, value)
      }}
      onCancel={() => onRenamingChange(false)}
    />
  ) : (
    <span className="row__label">{chat.title}</span>
  )

  // Состояние чата — кружок у правого края; у помощника слева значок его агента.
  const content = (
    <span className="chat-title">
      {compact && (
        <span className="worker-agent">
          {chat.fork ? (
            <GitFork className="agent-icon" aria-hidden />
          ) : (
            <AgentIcon agent={chat.agent} className="agent-icon" aria-hidden />
          )}
        </span>
      )}
      {title}
      {!compact && <ChatActivityStatus chatId={chat.id} workerChatIds={workerChatIds} />}
    </span>
  )

  return (
    <div
      className={compact ? 'row row--chat row--worker' : 'row row--chat'}
      data-active={active}
      data-visible={visible}
      title={compact ? (chat.fork ? 'Fork' : findAgent(chat.agent)?.name) : undefined}
      onContextMenu={openContextMenu}
      {...dragHandleProps}
    >
      {renaming ? (
        <div className="row__main chat-row">{content}</div>
      ) : (
        <button
          type="button"
          className="row__main chat-row"
          // ⌘-клик (на Linux — Ctrl-клик) открывает чат рядом с текущим, как в редакторах кода.
          onClick={(event) =>
            isCommandClick(event) ? openChatBeside(chat.id) : selectChat(chat.id)
          }
          onDoubleClick={() => onRenamingChange(true)}
        >
          {content}
        </button>
      )}
      {!compact && !renaming && <ChatPullRequest chatId={chat.id} />}
    </div>
  )
}

/**
 * PR ветки, в которой работает чат, — значок его состояния у правого края строки; щелчок
 * открывает PR. Нет PR или чат в основной ветке — нет и значка.
 */
function ChatPullRequest({ chatId }: { chatId: string }) {
  const pullRequest = useSyncExternalStore(chatPullRequests.subscribe, () =>
    chatPullRequests.get(chatId)
  )
  const hint = useHoverHint()
  useEffect(() => chatPullRequests.watch(chatId), [chatId])

  // Агент закончил ход — он мог создать PR, сменить ветку или смёрджить: спрашиваем заново.
  const working = useChatActivity(chatId) === 'working'
  const wasWorking = useRef(working)
  useEffect(() => {
    if (wasWorking.current && !working) {
      void chatPullRequests.refresh(chatId, true)
    }
    wasWorking.current = working
  }, [chatId, working])

  if (!pullRequest) {
    return null
  }
  const { icon: Icon, label } = PULL_REQUEST_LOOK[pullRequest.state]
  return (
    <>
      <button
        type="button"
        className="chat-pull-request"
        data-state={pullRequest.state}
        aria-label={`${label} pull request #${pullRequest.number}: ${pullRequest.title}`}
        onClick={() => window.open(pullRequest.url, '_blank', 'noreferrer')}
        onMouseEnter={(event) => hint.show(event.currentTarget)}
        onMouseLeave={hint.hide}
        onFocus={(event) => hint.show(event.currentTarget)}
        onBlur={hint.hide}
      >
        <Icon className="icon" aria-hidden />
      </button>
      {hint.anchor && (
        <HoverHint anchor={hint.anchor} placement="below">
          {label} · #{pullRequest.number} {pullRequest.title}
        </HoverHint>
      )}
    </>
  )
}

/** Подпись под чатом: сколько у него помощников и сколько ответвлений. */
function describeChildren(children: readonly Chat[]): string {
  const forks = children.filter(({ fork }) => fork).length
  const agents = children.length - forks
  return [
    agents > 0 && (agents === 1 ? '1 agent' : `${agents} agents`),
    forks > 0 && (forks === 1 ? '1 fork' : `${forks} forks`)
  ]
    .filter(Boolean)
    .join(', ')
}

/** Индикатор чата верхнего уровня: подписка на состояние только там, где индикатор виден. */
function ChatActivityStatus({
  chatId,
  workerChatIds
}: {
  chatId: string
  workerChatIds?: readonly string[]
}) {
  return <ChatStatus status={useChatActivity(chatId, workerChatIds)} />
}
