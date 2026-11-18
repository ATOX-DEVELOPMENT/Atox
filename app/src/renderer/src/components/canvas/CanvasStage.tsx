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
  groupBounds,
  screenBounds,
  unionRect,
  withLabel,
  wheelZoomFactor,
  zoomAround,
  type Point,
  type Rect
} from '../../lib/canvasView'
import { CanvasLinks } from './CanvasLinks'
import { FixBox } from './FixBox'
import { GroupFrame } from './GroupFrame'
import { ScreenFrame } from './ScreenFrame'
import type { ViewState } from './viewState'

/** Отступ от краёв, когда все экраны вписываются в окно, в пикселях окна. */
const FIT_MARGIN = 56
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
/** Сколько длится перелёт к экрану после клика, мс. */
const FOCUS_DURATION = 380
/** Пауза после смены масштаба, после которой холст перерисовывается в новом масштабе, мс. */
const VIEW_SETTLE_DELAY = 200

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
  /** Открывает «Fix» у экрана; `null` — закрывает. */
  onSelectScreen(screenId: string | null): void
  /** Клик по экрану: холст подвёл к нему вид. */
  onFocusScreen(screenId: string): void
  /** Версия из истории, которую показывает один из экранов. */
  preview: { screenId: string; versionId: string } | null
  chatTitle: string
  /** Подсказка и плашка агента поверх холста. */
  children?: ReactNode
  ref?: Ref<CanvasStageHandle>
}

/** Перенос: экраны, которые тянут, и на сколько они ушли от места, где их взяли. */
interface Drag {
  ids: ReadonlySet<string>
  dx: number
  dy: number
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
  onFocusScreen,
  preview,
  chatTitle,
  children,
  ref
}: CanvasStageProps) {
  const stageRef = useRef<HTMLDivElement>(null)
  const worldRef = useRef<HTMLDivElement>(null)
  // Экраны, которые тянут (один или все экраны группы), и отпущенные, но ещё не сохранённые в main.
  const [drag, setDrag] = useState<Drag | null>(null)
  const [dropped, setDropped] = useState<ReadonlyMap<string, Point>>(new Map())
  const [panning, setPanning] = useState(false)
  const saveTimerRef = useRef<number | undefined>(undefined)
  const flightRef = useRef<number | null>(null)
  const settleTimerRef = useRef<number | undefined>(undefined)
  // Масштаб, в котором слой холста нарисован сейчас.
  const rasterZoomRef = useRef<number | null>(null)
  const { id: canvasId, screens, groups } = canvas

  const positionOf = useCallback(
    (screen: CanvasScreen): Point => {
      const base = dropped.get(screen.id) ?? screen
      return drag?.ids.has(screen.id) ? { x: base.x + drag.dx, y: base.y + drag.dy } : base
    },
    [drag, dropped]
  )
  const bounds = useMemo(
    () => new Map(screens.map((screen) => [screen.id, screenBounds(screen, positionOf(screen))])),
    [screens, positionOf]
  )
  const boundsRef = useRef(bounds)
  boundsRef.current = bounds
  // Рамки групп строятся по экранам, поэтому следуют за ними и во время переноса.
  const groupRects = useMemo(
    () =>
      groups.flatMap((group) => {
        const rect = groupBounds(group, bounds)
        return rect ? [{ group, rect }] : []
      }),
    [groups, bounds]
  )
  const groupRectsRef = useRef(groupRects)
  groupRectsRef.current = groupRects

  // Вид сохраняется после паузы; закрытая страница сохраняет его сразу.
  const saveView = useCallback(() => {
    window.clearTimeout(saveTimerRef.current)
    saveTimerRef.current = undefined
    const view = viewState.view()
    if (view) {
      void window.atox.canvas.setView(canvasId, view)
    }
  }, [canvasId, viewState])
  const stopFlight = useCallback(() => {
    if (flightRef.current !== null) {
      cancelAnimationFrame(flightRef.current)
      flightRef.current = null
    }
  }, [])
  const commitView = useCallback(
    (view: CanvasView) => {
      // Колесо или протяжка во время перелёта забирают вид себе.
      stopFlight()
      viewState.set(view)
      window.clearTimeout(saveTimerRef.current)
      saveTimerRef.current = window.setTimeout(saveView, VIEW_SAVE_DELAY)
    },
    [viewState, saveView, stopFlight]
  )
  useEffect(
    () => () => {
      stopFlight()
      if (saveTimerRef.current !== undefined) {
        saveView()
      }
    },
    [saveView, stopFlight]
  )

  /** Вид, в который `content` вписывается целиком. */
  const viewFitting = useCallback(
    (content: Rect): CanvasView | null => {
      const viewport = viewState.viewport()
      return viewport.width === 0 ? null : fitView(content, viewport, FIT_MARGIN)
    },
    [viewState]
  )
  const fittedView = useCallback((): CanvasView | null => {
    const content = unionRect([
      ...[...boundsRef.current.values()].map(withLabel),
      ...groupRectsRef.current.map(({ rect }) => rect)
    ])
    return content && viewFitting(content)
  }, [viewFitting])

  // Перелёт к виду: камера плывёт к центру нового вида, а масштаб меняется плавно (по степени),
  // а не прыжком. Без анимации (настройка системы) вид меняется сразу.
  const flyTo = useCallback(
    (target: CanvasView) => {
      const from = viewState.view()
      const { width, height } = viewState.viewport()
      if (!from || window.matchMedia('(prefers-reduced-motion: reduce)').matches) {
        commitView(target)
        return
      }
      stopFlight()
      const centerOf = (view: CanvasView): Point => ({
        x: (width / 2 - view.x) / view.zoom,
        y: (height / 2 - view.y) / view.zoom
      })
      const a = centerOf(from)
      const b = centerOf(target)
      const startedAt = performance.now()
      const step = (now: number) => {
        const progress = Math.min(1, (now - startedAt) / FOCUS_DURATION)
        if (progress >= 1) {
          flightRef.current = null
          commitView(target)
          return
        }
        const eased = 1 - (1 - progress) ** 3
        const zoom = from.zoom * (target.zoom / from.zoom) ** eased
        const x = a.x + (b.x - a.x) * eased
        const y = a.y + (b.y - a.y) * eased
        viewState.set({ x: width / 2 - x * zoom, y: height / 2 - y * zoom, zoom })
        flightRef.current = requestAnimationFrame(step)
      }
      flightRef.current = requestAnimationFrame(step)
    },
    [viewState, commitView, stopFlight]
  )

  const focusScreen = useCallback(
    (screenId: string) => {
      const rect = boundsRef.current.get(screenId)
      const view = rect && viewFitting(withLabel(rect))
      if (view) {
        flyTo(view)
      }
      onFocusScreen(screenId)
    },
    [viewFitting, flyTo, onFocusScreen]
  )

  const focusGroup = useCallback(
    (groupId: string) => {
      const rect = groupRectsRef.current.find(({ group }) => group.id === groupId)?.rect
      const view = rect && viewFitting(rect)
      if (view) {
        flyTo(view)
      }
    },
    [viewFitting, flyTo]
  )

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

  // Вид — в transform и фон сетки. Экраны за краем окна не прячутся: скрытый iframe теряет
  // картинку, и при возвращении в кадр на миг пустеет; невидимое браузер и так не рисует.
  // Слой холста всегда с will-change: transform, чтобы прокрутка только двигала готовую картинку.
  // Но с ним Chromium не перерисовывает слой при смене масштаба: после приближения холст на 10%
  // остаётся нарисованным крупно, не помещается в память видеокарты, и при прокрутке новые куски
  // не дорисовываются — серые дыры. Поэтому после смены масштаба, когда жест затих, will-change
  // снимается на пару кадров, и слой перерисовывается в масштабе, в котором его видно.
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
    rasterZoomRef.current ??= view.zoom
    if (settleTimerRef.current === undefined && view.zoom === rasterZoomRef.current) {
      return
    }
    window.clearTimeout(settleTimerRef.current)
    settleTimerRef.current = window.setTimeout(() => {
      settleTimerRef.current = undefined
      rasterZoomRef.current = viewState.view()?.zoom ?? null
      world.style.willChange = 'auto'
      requestAnimationFrame(() =>
        requestAnimationFrame(() => {
          world.style.willChange = ''
        })
      )
    }, VIEW_SETTLE_DELAY)
  }, [viewState])
  useEffect(() => viewState.subscribe(applyView), [viewState, applyView])
  useEffect(() => () => window.clearTimeout(settleTimerRef.current), [])
  // Вид нужно применить и после отрисовки: холст мог только что появиться.
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

  // Экран или заголовок группы: протяжка переносит экраны, клик без протяжки подводит к ним вид.
  const screensRef = useRef(screens)
  screensRef.current = screens
  const positionOfRef = useRef(positionOf)
  positionOfRef.current = positionOf
  /**
   * Переносит `ids` вместе. `save` сохраняет итоговый сдвиг (в целых пикселях) в main; `onClick`
   * зовётся, когда мышь отпустили почти там же, где нажали.
   */
  const startMove = useCallback(
    (
      event: ReactPointerEvent<HTMLElement>,
      ids: ReadonlySet<string>,
      save: (dx: number, dy: number) => Promise<void>,
      onClick: () => void
    ) => {
      const view = viewState.view()
      // Ctrl-клик на macOS — правая кнопка: за него отвечает контекстное меню.
      if (!view || ids.size === 0 || event.button !== 0 || event.ctrlKey) {
        return
      }
      event.preventDefault()
      const target = event.currentTarget
      target.setPointerCapture(event.pointerId)
      const start = { x: event.clientX, y: event.clientY }
      const origins = new Map(
        screensRef.current
          .filter(({ id }) => ids.has(id))
          .map((screen) => [screen.id, positionOfRef.current(screen)])
      )
      let current: Point | null = null
      let frame: number | null = null
      const onMove = (move: PointerEvent) => {
        const dx = move.clientX - start.x
        const dy = move.clientY - start.y
        if (!current && Math.hypot(dx, dy) < DRAG_THRESHOLD) {
          return
        }
        current = { x: dx / view.zoom, y: dy / view.zoom }
        frame ??= requestAnimationFrame(() => {
          frame = null
          if (current) {
            setDrag({ ids, dx: current.x, dy: current.y })
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
            onClick()
          }
          return
        }
        if (end.type === 'pointercancel') {
          return
        }
        const dx = Math.round(current.x)
        const dy = Math.round(current.y)
        setDropped((map) => {
          const next = new Map(map)
          for (const [id, origin] of origins) {
            next.set(id, { x: origin.x + dx, y: origin.y + dy })
          }
          return next
        })
        // Сохранённое место приходит с новым состоянием холста; не сохранилось — экраны
        // возвращаются туда, где были.
        const settle = () =>
          setDropped((map) => {
            const next = new Map(map)
            origins.forEach((_origin, id) => next.delete(id))
            return next
          })
        void save(dx, dy).then(settle, settle)
      }
      target.addEventListener('pointermove', onMove)
      target.addEventListener('pointerup', onEnd)
      target.addEventListener('pointercancel', onEnd)
    },
    [viewState]
  )

  const handleScreenPointerDown = useCallback(
    (screenId: string, event: ReactPointerEvent<HTMLElement>) => {
      const origin = screensRef.current.find(({ id }) => id === screenId)
      if (!origin) {
        return
      }
      const from = positionOfRef.current(origin)
      startMove(
        event,
        new Set([screenId]),
        (dx, dy) => window.atox.canvas.moveScreen(canvasId, screenId, from.x + dx, from.y + dy),
        () => focusScreen(screenId)
      )
    },
    [canvasId, startMove, focusScreen]
  )

  const groupsRef = useRef(groups)
  groupsRef.current = groups
  const handleGroupPointerDown = useCallback(
    (groupId: string, event: ReactPointerEvent<HTMLElement>) => {
      const group = groupsRef.current.find(({ id }) => id === groupId)
      if (group) {
        startMove(
          event,
          new Set(group.screens),
          (dx, dy) => window.atox.canvas.moveGroup(canvasId, groupId, dx, dy),
          () => focusGroup(groupId)
        )
      }
    },
    [canvasId, startMove, focusGroup]
  )

  const selected = screens.find(({ id }) => id === selectedScreenId)
  const selectedBounds = selected && bounds.get(selected.id)
  const otherBounds = useMemo(
    () => [...bounds].filter(([id]) => id !== selectedScreenId).map(([, rect]) => rect),
    [bounds, selectedScreenId]
  )

  return (
    <div ref={stageRef} className="canvas-stage" data-panning={panning} onPointerDown={startPan}>
      <div ref={worldRef} className="canvas-stage__world">
        {groupRects.map(({ group, rect }) => (
          <GroupFrame
            key={group.id}
            canvasId={canvasId}
            group={group}
            rect={rect}
            dragging={group.screens.some((id) => drag?.ids.has(id))}
            onPointerDown={handleGroupPointerDown}
            onFocus={focusGroup}
          />
        ))}
        {screens.map((screen) => (
          <ScreenFrame
            key={screen.id}
            canvasId={canvasId}
            screen={screen}
            position={positionOf(screen)}
            selected={screen.id === selectedScreenId}
            dragging={drag?.ids.has(screen.id) ?? false}
            previewVersionId={preview?.screenId === screen.id ? preview.versionId : null}
            onPointerDown={handleScreenPointerDown}
            onFocus={focusScreen}
            onFix={onSelectScreen}
          />
        ))}
        <CanvasLinks links={canvas.links} screens={screens} bounds={bounds} />
      </div>
      {children}
      {selected && selectedBounds && (
        <FixBox
          // Новый экран — новое окно: текст просьбы к другому экрану не переносится.
          key={selected.id}
          viewState={viewState}
          screenId={selected.id}
          screenName={selected.name}
          buildError={selected.buildError}
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
