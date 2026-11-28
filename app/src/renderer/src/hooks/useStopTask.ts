import { useCallback, useEffect, useRef, useState } from 'react'
import type { BackgroundTask } from '../../../shared/conversation'

const { atox } = window

/** Сколько ждём, пока агент уберёт остановленную задачу из списка, прежде чем вернуть строку. */
const STOP_CONFIRM_TIMEOUT_MS = 8_000

const STOP_TIMEOUT_MESSAGE = 'The agent did not stop the task. Try again.'
const STOP_FAILED_MESSAGE = 'Could not stop the task.'

export interface StopTaskState {
  /** Задачи, которые просили остановить и от которых ждут подтверждения агента. */
  stopping: ReadonlySet<string>
  /** Почему задачу не удалось остановить — до следующей попытки. */
  errors: ReadonlyMap<string, string>
  stop(taskId: string): void
}

/**
 * Остановка фоновых задач чата. Строка задачи пропадает, когда агент подтвердил остановку
 * обновлением списка; не подтвердил за отведённое время или отказал — строка возвращается
 * с короткой ошибкой.
 */
export function useStopTask(chatId: string | null, tasks: readonly BackgroundTask[]): StopTaskState {
  const [stopping, setStopping] = useState<ReadonlySet<string>>(new Set())
  const [errors, setErrors] = useState<ReadonlyMap<string, string>>(new Map())
  const timers = useRef(new Map<string, ReturnType<typeof setTimeout>>())

  const settle = useCallback((taskId: string, error?: string) => {
    clearTimeout(timers.current.get(taskId))
    timers.current.delete(taskId)
    setStopping((current) => without(current, taskId))
    setErrors((current) => withError(current, taskId, error))
  }, [])

  const stop = useCallback(
    (taskId: string) => {
      if (!chatId) {
        return
      }
      setStopping((current) => new Set(current).add(taskId))
      setErrors((current) => withError(current, taskId))
      timers.current.set(
        taskId,
        setTimeout(() => settle(taskId, STOP_TIMEOUT_MESSAGE), STOP_CONFIRM_TIMEOUT_MS)
      )
      atox.conversations.stopTask(chatId, taskId).catch((error) => {
        console.error('Failed to stop the task', error)
        settle(taskId, STOP_FAILED_MESSAGE)
      })
    },
    [chatId, settle]
  )

  // Задача пропала из списка — агент подтвердил остановку, ждать больше нечего.
  useEffect(() => {
    const present = new Set(tasks.map(({ id }) => id))
    for (const taskId of [...timers.current.keys()]) {
      if (!present.has(taskId)) {
        settle(taskId)
      }
    }
  }, [tasks, settle])

  useEffect(() => {
    const pending = timers.current
    return () => pending.forEach((timer) => clearTimeout(timer))
  }, [])

  return { stopping, errors, stop }
}

function without(set: ReadonlySet<string>, value: string): ReadonlySet<string> {
  if (!set.has(value)) {
    return set
  }
  const next = new Set(set)
  next.delete(value)
  return next
}

function withError(
  errors: ReadonlyMap<string, string>,
  taskId: string,
  error?: string
): ReadonlyMap<string, string> {
  if (!errors.has(taskId) && error === undefined) {
    return errors
  }
  const next = new Map(errors)
  if (error === undefined) {
    next.delete(taskId)
  } else {
    next.set(taskId, error)
  }
  return next
}
