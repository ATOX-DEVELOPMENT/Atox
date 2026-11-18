import type { Canvas, CanvasState } from '../../../shared/canvas'

/**
 * Страницы холстов окна: список из main и страница, открытая сейчас. Хранилище, а не состояние
 * React: строка чата в сайдбаре подписывается только на свой холст и не перерисовывается, когда
 * меняется чужой.
 */
export class CanvasStore {
  private state: CanvasState | null = null
  /** Страницы чатов вне архива; сбрасывается с новым состоянием, чтобы снимок для React был стабилен. */
  private activeByChat = new Map<string, readonly Canvas[]>()
  /** Все страницы чатов, и в архиве тоже: по той же причине. */
  private pagesByChat = new Map<string, readonly Canvas[]>()
  /** Страница, открытая в холсте чата последней: сайдбар открывает холст на ней. */
  private readonly lastPageByChat = new Map<string, string>()
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

  /** Публикуется ли холст чата по ссылке прямо сейчас. */
  sharing(chatId: string): boolean {
    return this.state?.sharing.includes(chatId) ?? false
  }

  find(canvasId: string): Canvas | undefined {
    return this.state?.canvases.find(({ id }) => id === canvasId)
  }

  /** Страницы холста чата вне архива, в их порядке. */
  activeOfChat(chatId: string): readonly Canvas[] {
    let canvases = this.activeByChat.get(chatId)
    if (!canvases) {
      canvases = (this.state?.canvases ?? []).filter(
        (canvas) => canvas.chatId === chatId && !canvas.archived
      )
      this.activeByChat.set(chatId, canvases)
    }
    return canvases
  }

  /** Все страницы холста чата, и в архиве тоже, в их порядке. */
  pagesOfChat(chatId: string): readonly Canvas[] {
    let pages = this.pagesByChat.get(chatId)
    if (!pages) {
      pages = (this.state?.canvases ?? []).filter((canvas) => canvas.chatId === chatId)
      this.pagesByChat.set(chatId, pages)
    }
    return pages
  }

  /** Страница, на которой открывается холст чата: последняя открытая, а если её нет — первая. */
  entryPage(chatId: string): Canvas | undefined {
    const pages = this.activeOfChat(chatId)
    const lastId = this.lastPageByChat.get(chatId)
    return pages.find(({ id }) => id === lastId) ?? pages[0]
  }

  opened = (): string | null => this.openedId

  /** Чат, холст которого открыт на странице сейчас. */
  openedChat = (): string | null =>
    (this.openedId && this.find(this.openedId)?.chatId) || null

  setOpened(canvasId: string | null): void {
    if (canvasId !== this.openedId) {
      this.openedId = canvasId
      const page = canvasId ? this.find(canvasId) : undefined
      if (page) {
        this.lastPageByChat.set(page.chatId, page.id)
      }
      this.notify()
    }
  }

  private publish(state: CanvasState): void {
    this.state = state
    this.activeByChat = new Map()
    this.pagesByChat = new Map()
    this.notify()
  }

  private notify(): void {
    this.listeners.forEach((listener) => listener())
  }
}
