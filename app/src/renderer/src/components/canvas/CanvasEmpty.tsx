import { useState } from 'react'
import { RequestBox } from './RequestBox'

interface CanvasEmptyProps {
  canvasId: string
  /** Название чата холста; `null` — чата больше нет. */
  chatTitle: string | null
  onOpenChat(): void
}

/** Холст без экранов: что здесь появится и откуда. */
export function CanvasEmpty({ canvasId, chatTitle, onOpenChat }: CanvasEmptyProps) {
  const [asking, setAsking] = useState(false)

  return (
    <div className="canvas-empty">
      <div className="canvas-empty__ghosts" aria-hidden>
        <span className="canvas-empty__ghost canvas-empty__ghost--phone" />
        <span className="canvas-empty__ghost" />
        <span className="canvas-empty__ghost" />
      </div>
      <h2 className="canvas-empty__title">No screens yet</h2>
      <p className="canvas-empty__text">
        {chatTitle === null
          ? 'The chat of this canvas was deleted, so no agent can add screens to it.'
          : `This canvas is linked to the chat “${chatTitle}”. Ask the agent there to design something, and it will show up here.`}
      </p>
      {chatTitle !== null &&
        (asking ? (
          <RequestBox
            title="Ask the agent"
            placeholder="Describe the screens you want"
            chatTitle={chatTitle}
            onSend={(text) => window.atox.canvas.request(canvasId, text)}
            onClose={() => setAsking(false)}
          />
        ) : (
          <div className="canvas-empty__actions">
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
          </div>
        ))}
    </div>
  )
}
