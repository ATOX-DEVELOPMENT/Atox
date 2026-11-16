import type { Canvas, CanvasState } from '../../../shared/canvas'

/**
 * Холсты окна: список из main и холст, открытый сейчас на странице. Хранилище, а не состояние
 * React: строка чата в сайдбаре подписывается только на свой холст и не перерисовывается, когда
 * меняется чужой.
 */
export class CanvasStore {
  private state: CanvasState | null = null
  private openedId: string | null = null
  private readonly listeners = new Set<() => void>()
  private unsubscribe: (() => void) | null = null

  /** Начинает получать холсты из main; возвращает отписку. */
  connect(): () => void {
    let connected = true
    this.unsubscribe = window.atox.canvas.subscribe((state) => this.publish(state))
    void window.atox.canvas.get().then((initial) => {
      // Подписка могла принести свежее состояние раньше ответа на запрос.
      if (connected && !this.state) {
        this.publish(initial)
      }
    })
    return () => {
      connected = false
      this.unsubscribe?.()
      this.unsubscribe = null
    }
  }

  subscribe = (listener: () => void): (() => void) => {
    this.listeners.add(listener)
    return () => this.listeners.delete(listener)
  }

  /** Все холсты, и в архиве тоже; `null` — ещё не загружены. */
  canvases = (): readonly Canvas[] | null => this.state?.canvases ?? null

  find(canvasId: string): Canvas | undefined {
    return this.state?.canvases.find(({ id }) => id === canvasId)
  }

  /** Холст чата вне архива: у чата он не больше одного. */
  activeOfChat(chatId: string): Canvas | undefined {
    return this.state?.canvases.find((canvas) => canvas.chatId === chatId && !canvas.archived)
  }

  opened = (): string | null => this.openedId

  setOpened(canvasId: string | null): void {
    if (canvasId !== this.openedId) {
      this.openedId = canvasId
      this.notify()
    }
  }

  private publish(state: CanvasState): void {
    this.state = state
    this.notify()
  }

  private notify(): void {
    this.listeners.forEach((listener) => listener())
  }
}
