import { useEffect, useId, useRef, useState, type KeyboardEvent, type Ref } from 'react'
import { CornerDownLeft } from 'lucide-react'
import { ipcErrorMessage } from '../../lib/ipcError'

interface RequestBoxProps {
  title: string
  /** Подпись справа от заголовка, например «Screen: Login». */
  subtitle?: string
  /** Что ещё уйдёт агенту вместе с текстом: «screen: Login», «screenshot». */
  context?: readonly string[]
  placeholder: string
  /** Что человеку стоит знать до отправки, например ошибка сборки экрана; показывается красным. */
  notice?: string | null
  /** Чат холста: в него уйдёт просьба. */
  chatTitle: string
  onSend(text: string): Promise<void>
  onClose(): void
  ref?: Ref<HTMLDivElement>
}

/**
 * Окно просьбы к агенту чата холста: «Fix» у экрана и «Ask here» у пустого холста. Enter
 * отправляет, Shift+Enter — новая строка, Esc закрывает. Если отправить не вышло, текст
 * остаётся, а ошибка видна под полем.
 */
export function RequestBox({
  title,
  subtitle,
  context = [],
  placeholder,
  notice,
  chatTitle,
  onSend,
  onClose,
  ref
}: RequestBoxProps) {
  const [text, setText] = useState('')
  const [sending, setSending] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const fieldRef = useRef<HTMLTextAreaElement>(null)
  const titleId = useId()
  const errorId = useId()
  const canSend = text.trim().length > 0 && !sending

  useEffect(() => {
    fieldRef.current?.focus({ preventScroll: true })
  }, [])

  const send = async () => {
    if (!canSend) {
      return
    }
    setSending(true)
    setError(null)
    try {
      await onSend(text.trim())
      onClose()
    } catch (failure) {
      setError(ipcErrorMessage(failure))
      setSending(false)
      fieldRef.current?.focus({ preventScroll: true })
    }
  }

  // Esc и Enter принадлежат окну: дальше они не идут, иначе Esc закрыл бы страницу холста.
  const handleKeyDown = (event: KeyboardEvent<HTMLElement>) => {
    if (event.key === 'Escape') {
      event.preventDefault()
      event.stopPropagation()
      onClose()
    } else if (event.key === 'Enter' && !event.shiftKey && !event.nativeEvent.isComposing) {
      event.preventDefault()
      void send()
    }
  }

  return (
    <div
      ref={ref}
      className="request-box"
      role="dialog"
      aria-labelledby={titleId}
      data-sending={sending}
      onKeyDown={handleKeyDown}
    >
      <div className="request-box__top">
        <span id={titleId} className="request-box__title">
          {title}
        </span>
        {subtitle && <span className="request-box__subtitle">{subtitle}</span>}
      </div>
      {context.length > 0 && (
        <div className="request-box__context">
          {context.map((item) => (
            <span key={item} className="request-box__chip">
              {item}
            </span>
          ))}
        </div>
      )}
      <textarea
        ref={fieldRef}
        className="request-box__field"
        aria-label={title}
        aria-describedby={error ? errorId : undefined}
        aria-invalid={error !== null}
        placeholder={placeholder}
        value={text}
        readOnly={sending}
        rows={3}
        onChange={(event) => setText(event.target.value)}
      />
      {notice && (
        <p className="request-box__notice" title={notice}>
          {notice}
        </p>
      )}
      {error && (
        <p id={errorId} className="request-box__error" role="alert">
          {error}
        </p>
      )}
      <div className="request-box__footer">
        <span className="request-box__chat" title={chatTitle}>
          <span className="request-box__dot" aria-hidden />
          <span className="request-box__chat-title">Chat: {chatTitle}</span>
        </span>
        <button type="button" className="canvas-button" onClick={onClose}>
          Esc
        </button>
        <button
          type="button"
          className="canvas-button canvas-button--primary"
          disabled={!canSend}
          onClick={() => void send()}
        >
          {sending ? 'Sending…' : 'Send'}
          <kbd className="canvas-button__key" aria-hidden>
            <CornerDownLeft />
          </kbd>
        </button>
      </div>
    </div>
  )
}
