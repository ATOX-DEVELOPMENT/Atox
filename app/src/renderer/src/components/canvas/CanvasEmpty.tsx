import { useState, type MouseEvent } from 'react'
import { RequestBox } from './RequestBox'

/**
 * Чат холста: `linked` — чат есть, `none` — холст создан без чата и его ещё не привязали,
 * `deleted` — чата больше нет.
 */
export type CanvasChatState =
  | { kind: 'linked'; title: string }
  | { kind: 'none' }
  | { kind: 'deleted' }

interface CanvasEmptyProps {
  canvasId: string
  chat: CanvasChatState
  onOpenChat(): void
  /** Окно выбора размера пустого экрана. */
  onAddScreen(): void
  /** Холст без чата: новый агент для него и привязка к чату проекта. */
  onStartAgent(): void
  onLinkChat(event: MouseEvent<HTMLButtonElement>): void
}

/** Страница без экранов: что здесь появится и откуда. */
export function CanvasEmpty({
  canvasId,
  chat,
  onOpenChat,
  onAddScreen,
  onStartAgent,
  onLinkChat
}: CanvasEmptyProps) {
  const [asking, setAsking] = useState(false)

  const addScreen = (
    <button
      type="button"
      className={`canvas-button${chat.kind === 'linked' ? '' : ' canvas-button--primary'}`}
      onClick={onAddScreen}
    >
      Add blank screen
    </button>
  )

  return (
    <div className="canvas-empty">
      <div className="canvas-empty__ghosts" aria-hidden>
        <span className="canvas-empty__ghost canvas-empty__ghost--phone" />
        <span className="canvas-empty__ghost" />
        <span className="canvas-empty__ghost" />
      </div>
      <h2 className="canvas-empty__title">No screens yet</h2>
      <p className="canvas-empty__text">{describe(chat)}</p>
      {chat.kind === 'linked' && asking ? (
        <RequestBox
          title="Ask the agent"
          placeholder="Describe the screens you want"
          chatTitle={chat.title}
          onSend={(text) => window.atox.canvas.request(canvasId, text)}
          onClose={() => setAsking(false)}
        />
      ) : (
        <div className="canvas-empty__actions">
          {chat.kind === 'linked' && (
            <>
              <button
                type="button"
                className="canvas-button canvas-button--primary"
                onClick={onOpenChat}
              >
                Open chat
              </button>
              <button type="button" className="canvas-button" onClick={() => setAsking(true)}>
                Ask here
              </button>
            </>
          )}
          {addScreen}
          {chat.kind === 'none' && (
            <>
              <button type="button" className="canvas-button" onClick={onStartAgent}>
                Start agent
              </button>
              <button type="button" className="canvas-button" onClick={onLinkChat}>
                Link to chat…
              </button>
            </>
          )}
        </div>
      )}
    </div>
  )
}

function describe(chat: CanvasChatState): string {
  switch (chat.kind) {
    case 'linked':
      return `This canvas is linked to the chat “${chat.title}”. Ask the agent there to design something on this page, and it will show up here.`
    case 'none':
      return 'This canvas has no chat yet. Add a blank screen of any size, or start an agent or link a chat to have screens designed here.'
    case 'deleted':
      return 'The chat of this canvas was deleted, so no agent can add screens to it. You can still add blank screens.'
  }
}
