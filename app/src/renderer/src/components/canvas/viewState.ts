import type { CanvasView } from '../../../../shared/canvas'
import type { Size } from '../../lib/canvasView'

/**
 * Сдвиг и масштаб холста на экране. Меняются на каждом кадре жеста, поэтому живут вне React:
 * подписчики (сцена, мини-карта, окно «Fix», масштаб в шапке) получают одно уведомление
 * за кадр и сами пишут в DOM то, что им нужно.
 */
export class ViewState {
  private current: CanvasView | null = null
  private size: Size = { width: 0, height: 0 }
  private readonly listeners = new Set<() => void>()
  private frame: number | null = null

  /** `null` — вид ещё не выбран: окно сцены не измерено. */
  view = (): CanvasView | null => this.current

  viewport = (): Size => this.size

  /** Масштаб в процентах, как в подписи: меняется реже самого масштаба. */
  zoomPercent = (): number | null =>
    this.current === null ? null : Math.round(this.current.zoom * 100)

  set(view: CanvasView): void {
    this.current = view
    this.schedule()
  }

  setViewport(size: Size): void {
    this.size = size
    this.schedule()
  }

  subscribe = (listener: () => void): (() => void) => {
    this.listeners.add(listener)
    return () => this.listeners.delete(listener)
  }

  /** Отменяет уведомление, которое ещё не разослано: страница холста закрывается. */
  cancel(): void {
    if (this.frame !== null) {
      cancelAnimationFrame(this.frame)
      this.frame = null
    }
  }

  private schedule(): void {
    this.frame ??= requestAnimationFrame(() => {
      this.frame = null
      this.listeners.forEach((listener) => listener())
    })
  }
}
