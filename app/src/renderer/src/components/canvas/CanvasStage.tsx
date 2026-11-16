import {
  useCallback,
  useEffect,
  useImperativeHandle,
  useLayoutEffect,
  useMemo,
  useRef,
  useState,
  type PointerEvent as ReactPointerEvent,
  type ReactNode,
  type Ref
} from 'react'
import type { Canvas, CanvasScreen, CanvasView } from '../../../../shared/canvas'
import {
  fitView,
  inflate,
  intersects,
  screenBounds,
  unionRect,
  visibleArea,
  wheelZoomFactor,
  zoomAround,
  type Point,
  type Rect
} from '../../lib/canvasView'
import { CanvasMinimap } from './CanvasMinimap'
import { FixBox } from './FixBox'
import { ScreenFrame } from './ScreenFrame'
import type { ViewState } from './viewState'

/** Отступ от краёв, когда все экраны вписываются в окно, в пикселях окна. */
const FIT_MARGIN = 56
/** Место над экранами для их подписей, в пикселях окна. */
const LABEL_SPACE = 32
/** На сколько пикселей нужно сдвинуть мышь, чтобы клик по экрану стал перетаскиванием. */
const DRAG_THRESHOLD = 4
/** Чувствительность масштаба к колесу и щипку трекпада. */
const WHEEL_ZOOM_SENSITIVITY = 0.01
/** Один щелчок колеса мыши даёт сотню пикселей — масштаб меняется шагом, а не прыжком. */
const WHEEL_ZOOM_DELTA_LIMIT = 40
/** Высота строки, когда колесо прокручивает строками, а не пикселями. */
const WHEEL_LINE_HEIGHT = 16
/** Пауза, после которой вид сохраняется: не на каждом кадре жеста. */
const VIEW_SAVE_DELAY = 600
/** Экраны дальше этого расстояния от окна (в его размерах) не рисуются. */
const OFFSCREEN_MARGIN = 0.5

export interface CanvasStageHandle {
  /** Вписывает все экраны в окно. */
  fit(): void
  /** Возвращает масштаб 100%, не сдвигая центр окна. */
  resetZoom(): void
}

interface CanvasStageProps {
  canvas: Canvas
  viewState: ViewState
  selectedScreenId: string | null
  onSelectScreen(screenId: string | null): void
  /** Версия из истории, которую показывает один из экранов. */
  preview: { screenId: string; versionId: string } | null
  chatTitle: string
  /** Подсказка и плашка агента поверх холста. */
  children?: ReactNode
  ref?: Ref<CanvasStageHandle>
}

interface Drag extends Point {
  screenId: string
}

/**
 * Бесконечный холст с экранами: колесо и трекпад двигают его, щипок и ⌘/Ctrl с колесом
 * масштабируют вокруг курсора, протяжка по пустому месту двигает, протяжка экрана переносит
 * экран, клик по экрану открывает «Fix». Сдвиг и масштаб пишутся прямо в transform, без
 * перерисовки React.
 */
export function CanvasStage({
  canvas,
  viewState,
  selectedScreenId,
  onSelectScreen,
  preview,
  chatTitle,
  children,
  ref
}: CanvasStageProps) {
  const stageRef = useRef<HTMLDivElement>(null)
  const worldRef = useRef<HTMLDivElement>(null)
  // Экран, который тянут, и экраны, отпущенные, но ещё не сохранённые в main.
  const [drag, setDrag] = useState<Drag | null>(null)
  const [dropped, setDropped] = useState<ReadonlyMap<string, Point>>(new Map())
  const [panning, setPanning] = useState(false)
  const saveTimerRef = useRef<number | undefined>(undefined)
  const { id: canvasId, screens } = canvas

  const positionOf = useCallback(
    (screen: CanvasScreen): Point =>
      drag?.screenId === screen.id ? drag : (dropped.get(screen.id) ?? screen),
    [drag, dropped]
  )
  const bounds = useMemo(
    () => new Map(screens.map((screen) => [screen.id, screenBounds(screen, positionOf(screen))])),
    [screens, positionOf]
  )
  const boundsRef = useRef(bounds)
  boundsRef.current = bounds

  // Вид сохраняется после паузы; закрытая страница сохраняет его сразу.
  const saveView = useCallback(() => {
    window.clearTimeout(saveTimerRef.current)
    saveTimerRef.current = undefined
    const view = viewState.view()
    if (view) {
      void window.atox.canvas.setView(canvasId, view)
    }
  }, [canvasId, viewState])
  const commitView = useCallback(
    (view: CanvasView) => {
      viewState.set(view)
      window.clearTimeout(saveTimerRef.current)
      saveTimerRef.current = window.setTimeout(saveView, VIEW_SAVE_DELAY)
    },
    [viewState, saveView]
  )
  useEffect(
    () => () => {
      if (saveTimerRef.current !== undefined) {
        saveView()
      }
    },
    [saveView]
  )

  const fittedView = useCallback((): CanvasView | null => {
    const content = unionRect([...boundsRef.current.values()])
    const viewport = viewState.viewport()
    if (!content || viewport.width === 0) {
      return null
    }
    // Подписи над экранами не масштабируются: место под них зависит от итогового масштаба.
    const first = fitView(content, viewport, FIT_MARGIN)
    const labelSpace = LABEL_SPACE / first.zoom
    return fitView(
      { ...content, y: content.y - labelSpace, height: content.height + labelSpace },
      viewport,
      FIT_MARGIN
    )
  }, [viewState])

  useImperativeHandle(
    ref,
    () => ({
      fit: () => {
        const view = fittedView()
        if (view) {
          commitView(view)
        }
      },
      resetZoom: () => {
        const view = viewState.view()
        const { width, height } = viewState.viewport()
        if (view) {
          commitView(zoomAround(view, { x: width / 2, y: height / 2 }, 1))
        }
      }
    }),
    [fittedView, commitView, viewState]
  )

  // Размер окна холста; первый замер выбирает вид: сохранённый или вписанные экраны.
  // Сохранённый вид нужен только при открытии: дальше вид меняет сам человек.
  const savedViewRef = useRef(canvas.view)
  useLayoutEffect(() => {
    const stage = stageRef.current
    if (!stage) {
      return
    }
    const measure = () => {
      viewState.setViewport({ width: stage.clientWidth, height: stage.clientHeight })
      if (!viewState.view()) {
        const initial = savedViewRef.current ?? fittedView()
        if (initial) {
          viewState.set(initial)
        }
      }
    }
    measure()
    const observer = new ResizeObserver(measure)
    observer.observe(stage)
    return () => observer.disconnect()
  }, [viewState, fittedView])

  // Вид — в transform и фон сетки; экраны далеко за краем окна не рисуются.
  const applyView = useCallback(() => {
    const stage = stageRef.current
    const world = worldRef.current
    const view = viewState.view()
    if (!stage || !world || !view) {
      return
    }
    world.style.transform = `translate(${view.x}px, ${view.y}px) scale(${view.zoom})`
    world.style.setProperty('--z', String(view.zoom))
    stage.style.backgroundPosition = `${view.x}px ${view.y}px`
    const viewport = viewState.viewport()
    const area = inflate(
      visibleArea(view, viewport),
      (Math.max(viewport.width, viewport.height) * OFFSCREEN_MARGIN) / view.zoom
    )
    for (const element of world.querySelectorAll<HTMLElement>('[data-screen-id]')) {
      const rect = boundsRef.current.get(element.dataset.screenId ?? '')
      element.dataset.offscreen = String(!rect || !intersects(rect, area))
    }
  }, [viewState])
  useEffect(() => viewState.subscribe(applyView), [viewState, applyView])
  // Экраны могли сдвинуться или добавиться: их видимость пересчитывается после отрисовки.
  useLayoutEffect(applyView)

  // Колесо слушается напрямую: React вешает его пассивным, и холст не смог бы отменить прокрутку.
  useEffect(() => {
    const stage = stageRef.current
    if (!stage) {
      return
    }
    const onWheel = (event: WheelEvent) => {
      const view = viewState.view()
      // Внутри окна «Fix» колесо прокручивает его поле, а не холст.
      if (!view || (event.target instanceof Element && event.target.closest('.request-box'))) {
        return
      }
      event.preventDefault()
      const unit =
        event.deltaMode === WheelEvent.DOM_DELTA_LINE
          ? WHEEL_LINE_HEIGHT
          : event.deltaMode === WheelEvent.DOM_DELTA_PAGE
            ? viewState.viewport().height
            : 1
      if (event.ctrlKey || event.metaKey) {
        const rect = stage.getBoundingClientRect()
        const delta = Math.max(
          -WHEEL_ZOOM_DELTA_LIMIT,
          Math.min(event.deltaY * unit, WHEEL_ZOOM_DELTA_LIMIT)
        )
        commitView(
          zoomAround(
            view,
            { x: event.clientX - rect.left, y: event.clientY - rect.top },
            view.zoom * wheelZoomFactor(delta, WHEEL_ZOOM_SENSITIVITY)
          )
        )
      } else {
        commitView({ ...view, x: view.x - event.deltaX * unit, y: view.y - event.deltaY * unit })
      }
    }
    stage.addEventListener('wheel', onWheel, { passive: false })
    return () => stage.removeEventListener('wheel', onWheel)
  }, [viewState, commitView])

  // Протяжка по пустому месту двигает холст; клик по нему снимает выбор экрана.
  const startPan = (event: ReactPointerEvent<HTMLDivElement>) => {
    const view = viewState.view()
    const onBackground = event.target === stageRef.current || event.target === worldRef.current
    if (!view || !onBackground || event.button !== 0) {
      return
    }
    const stage = event.currentTarget
    const pointerId = event.pointerId
    const start = { x: event.clientX, y: event.clientY }
    let moved = false
    stage.setPointerCapture(pointerId)
    const onMove = (move: PointerEvent) => {
      const dx = move.clientX - start.x
      const dy = move.clientY - start.y
      if (!moved && Math.hypot(dx, dy) < DRAG_THRESHOLD) {
        return
      }
      if (!moved) {
        moved = true
        setPanning(true)
      }
      commitView({ ...view, x: view.x + dx, y: view.y + dy })
    }
    const onEnd = () => {
      stage.removeEventListener('pointermove', onMove)
      stage.removeEventListener('pointerup', onEnd)
      stage.removeEventListener('pointercancel', onEnd)
      setPanning(false)
      if (!moved) {
        onSelectScreen(null)
      }
    }
    stage.addEventListener('pointermove', onMove)
    stage.addEventListener('pointerup', onEnd)
    stage.addEventListener('pointercancel', onEnd)
  }

  // Экран: протяжка переносит его, клик без протяжки открывает «Fix».
  const screensRef = useRef(screens)
  screensRef.current = screens
  const positionOfRef = useRef(positionOf)
  positionOfRef.current = positionOf
  const handleScreenPointerDown = useCallback(
    (screenId: string, event: ReactPointerEvent<HTMLElement>) => {
      const view = viewState.view()
      const screen = screensRef.current.find(({ id }) => id === screenId)
      if (!view || !screen || event.button !== 0) {
        return
      }
      event.preventDefault()
      const target = event.currentTarget
      target.setPointerCapture(event.pointerId)
      const start = { x: event.clientX, y: event.clientY }
      const origin = positionOfRef.current(screen)
      let current: Point | null = null
      let frame: number | null = null
      const onMove = (move: PointerEvent) => {
        const dx = move.clientX - start.x
        const dy = move.clientY - start.y
        if (!current && Math.hypot(dx, dy) < DRAG_THRESHOLD) {
          return
        }
        current = { x: origin.x + dx / view.zoom, y: origin.y + dy / view.zoom }
        frame ??= requestAnimationFrame(() => {
          frame = null
          if (current) {
            setDrag({ screenId, ...current })
          }
        })
      }
      const onEnd = (end: PointerEvent) => {
        target.removeEventListener('pointermove', onMove)
        target.removeEventListener('pointerup', onEnd)
        target.removeEventListener('pointercancel', onEnd)
        if (frame !== null) {
          cancelAnimationFrame(frame)
        }
        setDrag(null)
        if (!current) {
          if (end.type === 'pointerup') {
            onSelectScreen(screenId)
          }
          return
        }
        if (end.type === 'pointercancel') {
          return
        }
        const position = { x: Math.round(current.x), y: Math.round(current.y) }
        setDropped((map) => new Map(map).set(screenId, position))
        void window.atox.canvas
          .moveScreen(canvasId, screenId, position.x, position.y)
          .finally(() =>
            setDropped((map) => {
              const next = new Map(map)
              next.delete(screenId)
              return next
            })
          )
      }
      target.addEventListener('pointermove', onMove)
      target.addEventListener('pointerup', onEnd)
      target.addEventListener('pointercancel', onEnd)
    },
    [canvasId, viewState, onSelectScreen]
  )

  const centerAt = useCallback(
    (point: Point) => {
      const view = viewState.view()
      const { width, height } = viewState.viewport()
      if (view) {
        commitView({
          ...view,
          x: width / 2 - point.x * view.zoom,
          y: height / 2 - point.y * view.zoom
        })
      }
    },
    [viewState, commitView]
  )

  const selected = screens.find(({ id }) => id === selectedScreenId)
  const selectedBounds = selected && bounds.get(selected.id)
  const otherBounds = useMemo(
    () => [...bounds].filter(([id]) => id !== selectedScreenId).map(([, rect]) => rect),
    [bounds, selectedScreenId]
  )
  const allBounds = useMemo((): Rect[] => [...bounds.values()], [bounds])

  return (
    <div
      ref={stageRef}
      className="canvas-stage"
      data-panning={panning}
      onPointerDown={startPan}
    >
      <div ref={worldRef} className="canvas-stage__world">
        {screens.map((screen) => (
          <ScreenFrame
            key={screen.id}
            canvasId={canvasId}
            screen={screen}
            position={positionOf(screen)}
            selected={screen.id === selectedScreenId}
            dragging={drag?.screenId === screen.id}
            previewVersionId={preview?.screenId === screen.id ? preview.versionId : null}
            onPointerDown={handleScreenPointerDown}
            onSelect={onSelectScreen}
          />
        ))}
      </div>
      {children}
      <CanvasMinimap viewState={viewState} rects={allBounds} onCenter={centerAt} />
      {selected && selectedBounds && (
        <FixBox
          // Новый экран — новое окно: текст просьбы к другому экрану не переносится.
          key={selected.id}
          viewState={viewState}
          screenId={selected.id}
          screenName={selected.name}
          target={selectedBounds}
          obstacles={otherBounds}
          chatTitle={chatTitle}
          onSend={(text) => window.atox.canvas.request(canvasId, text, selected.id)}
          onClose={() => onSelectScreen(null)}
        />
      )}
    </div>
  )
}
