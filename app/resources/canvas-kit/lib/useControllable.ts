import { useCallback, useState } from 'react'

/**
 * Значение, которым может управлять родитель (value + onChange) или сам компонент
 * (defaultValue): статичный макет работает без обвязки, живой прототип с ней.
 */
export function useControllable<T>(
  value: T | undefined,
  defaultValue: T,
  onChange?: (next: T) => void
): [T, (next: T) => void] {
  const [inner, setInner] = useState(defaultValue)
  const current = value === undefined ? inner : value
  const set = useCallback(
    (next: T) => {
      if (value === undefined) setInner(next)
      onChange?.(next)
    },
    [value, onChange]
  )
  return [current, set]
}
