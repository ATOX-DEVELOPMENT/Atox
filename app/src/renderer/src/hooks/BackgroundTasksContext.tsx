import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
  type ReactNode
} from 'react'
import type { BackgroundTask } from '../../../shared/conversation'

interface BackgroundTasksStore {
  byChat: ReadonlyMap<string, readonly BackgroundTask[]>
  report(chatId: string, tasks: readonly BackgroundTask[] | undefined): void
}

const BackgroundTasksContext = createContext<BackgroundTasksStore | null>(null)

const NO_TASKS: readonly BackgroundTask[] = []

/**
 * Фоновые задачи агентов по чатам. Ленту чата читает его панель, а задачи нужны и шапке
 * рабочей области, и панели справа: чат сообщает их сюда.
 */
export function BackgroundTasksProvider({ children }: { children: ReactNode }) {
  const [byChat, setByChat] = useState<ReadonlyMap<string, readonly BackgroundTask[]>>(new Map())
  // Одна и та же функция на всё время: эффекты чатов не перезапускаются от чужих задач.
  const report = useCallback(
    (chatId: string, tasks: readonly BackgroundTask[] | undefined) =>
      setByChat((current) => {
        if ((current.get(chatId) ?? NO_TASKS) === (tasks ?? NO_TASKS)) {
          return current
        }
        const next = new Map(current)
        if (tasks && tasks.length > 0) {
          next.set(chatId, tasks)
        } else {
          next.delete(chatId)
        }
        return next
      }),
    []
  )
  const store = useMemo(() => ({ byChat, report }), [byChat, report])
  return <BackgroundTasksContext.Provider value={store}>{children}</BackgroundTasksContext.Provider>
}

function useStore(): BackgroundTasksStore {
  const store = useContext(BackgroundTasksContext)
  if (!store) {
    throw new Error('Background tasks are used outside BackgroundTasksProvider')
  }
  return store
}

/** Чат сообщает свои фоновые задачи; когда чат закрыт, они забываются. */
export function useReportBackgroundTasks(
  chatId: string,
  tasks: readonly BackgroundTask[] | undefined
): void {
  const { report } = useStore()
  useEffect(() => report(chatId, tasks), [report, chatId, tasks])
  useEffect(() => () => report(chatId, undefined), [report, chatId])
}

/** Фоновые задачи чата, которые идут сейчас; `null` — чата нет. */
export function useBackgroundTasks(chatId: string | null): readonly BackgroundTask[] {
  const { byChat } = useStore()
  return (chatId && byChat.get(chatId)) || NO_TASKS
}
