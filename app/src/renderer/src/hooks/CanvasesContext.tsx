import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useState,
  useSyncExternalStore,
  type ReactNode
} from 'react'
import type { Canvas } from '../../../shared/canvas'
import { CanvasStore } from './useCanvases'

const CanvasStoreContext = createContext<CanvasStore | null>(null)

/** Переходы к страницам холстов; ссылки на функции не меняются. */
export interface CanvasNavigation {
  openCanvas(canvasId: string): void
  openCanvasList(): void
  openChat(chatId: string): void
}

const CanvasNavigationContext = createContext<CanvasNavigation | null>(null)

export function CanvasesProvider({ children }: { children: ReactNode }) {
  const [store] = useState(() => new CanvasStore())
  useEffect(() => store.connect(), [store])
  return <CanvasStoreContext.Provider value={store}>{children}</CanvasStoreContext.Provider>
}

export function CanvasNavigationProvider({
  navigation,
  children
}: {
  navigation: CanvasNavigation
  children: ReactNode
}) {
  return (
    <CanvasNavigationContext.Provider value={navigation}>
      {children}
    </CanvasNavigationContext.Provider>
  )
}

export function useCanvasStore(): CanvasStore {
  const store = useContext(CanvasStoreContext)
  if (!store) {
    throw new Error('useCanvasStore must be used within CanvasesProvider')
  }
  return store
}

export function useCanvasNavigation(): CanvasNavigation {
  const navigation = useContext(CanvasNavigationContext)
  if (!navigation) {
    throw new Error('useCanvasNavigation must be used within CanvasNavigationProvider')
  }
  return navigation
}

/** Все холсты, и в архиве тоже; `null` — ещё не загружены. */
export function useCanvases(): readonly Canvas[] | null {
  const store = useCanvasStore()
  return useSyncExternalStore(store.subscribe, store.canvases)
}

/** Холст по id; `undefined` — его нет (удалён или ещё не загружен). */
export function useCanvas(canvasId: string): Canvas | undefined {
  const store = useCanvasStore()
  const select = useCallback(() => store.find(canvasId), [store, canvasId])
  return useSyncExternalStore(store.subscribe, select)
}

/** Холсты чата вне архива: у чата их может быть несколько. */
export function useChatCanvases(chatId: string): readonly Canvas[] {
  const store = useCanvasStore()
  const select = useCallback(() => store.activeOfChat(chatId), [store, chatId])
  return useSyncExternalStore(store.subscribe, select)
}

/** Открыт ли этот холст на странице сейчас. */
export function useCanvasOpened(canvasId: string): boolean {
  const store = useCanvasStore()
  const select = useCallback(() => store.opened() === canvasId, [store, canvasId])
  return useSyncExternalStore(store.subscribe, select)
}
