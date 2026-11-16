import { useId, type ReactNode } from 'react'
import { cn } from '../lib/cn'

export interface FieldProps {
  label?: ReactNode
  /** Ссылка или счётчик справа от подписи: «Forgot password?». */
  labelAction?: ReactNode
  help?: ReactNode
  /** Текст ошибки; заменяет help и красит подсказку. */
  error?: ReactNode
  required?: boolean
  /** Поле получает id через render-функцию, чтобы подпись была связана с ним. */
  children: ReactNode | ((id: string) => ReactNode)
  className?: string
}

/** Поле формы: подпись, контрол, подсказка или ошибка. */
export function Field({ label, labelAction, help, error, required, children, className }: FieldProps) {
  const id = useId()
  return (
    <div className={cn('grid gap-1.5', className)}>
      {(label || labelAction) && (
        <div className="flex items-center justify-between gap-3">
          {label && (
            <label htmlFor={id} className="text-sm font-semibold text-fg">
              {label}
              {required && <span className="ml-0.5 text-danger-text">*</span>}
            </label>
          )}
          {labelAction && <span className="text-sm">{labelAction}</span>}
        </div>
      )}
      {typeof children === 'function' ? children(id) : children}
      {(error || help) && (
        <p className={cn('text-xs', error ? 'text-danger-text' : 'text-fg-muted')}>{error ?? help}</p>
      )}
    </div>
  )
}
