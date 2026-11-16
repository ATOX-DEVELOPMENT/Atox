import { useChatActivity } from '../../hooks/ChatActivityContext'
import { useConversationSummaries } from '../../hooks/useConversationSummaries'

interface AgentBarProps {
  chatId: string
  chatTitle: string
  onOpenChat(): void
}

/** Плашка внизу холста, пока агент его чата работает: что он правит и где его найти. */
export function AgentBar({ chatId, chatTitle, onOpenChat }: AgentBarProps) {
  // Сводки разговоров читаются, только пока агент работает: иначе плашки нет.
  return useChatActivity(chatId) === 'working' ? (
    <WorkingAgentBar chatId={chatId} chatTitle={chatTitle} onOpenChat={onOpenChat} />
  ) : null
}

function WorkingAgentBar({ chatId, chatTitle, onOpenChat }: AgentBarProps) {
  const step = useConversationSummaries()?.find((summary) => summary.chatId === chatId)?.step
  // Шаг правки называется путём к файлу; показывается только имя файла.
  const file =
    step?.kind === 'tool' && step.tool === 'edit' ? step.title.split(/[\\/]/).pop() : undefined

  return (
    <div className="agent-bar" data-canvas-ui role="status">
      <span className="agent-bar__spinner" aria-hidden />
      <span className="agent-bar__text">
        {file ? (
          <>
            Editing <b className="agent-bar__file">{file}</b>
          </>
        ) : (
          'Agent is working'
        )}
        <span className="agent-bar__chat"> in chat {chatTitle}</span>
      </span>
      <button type="button" className="agent-bar__button" onClick={onOpenChat}>
        Open chat
      </button>
    </div>
  )
}
