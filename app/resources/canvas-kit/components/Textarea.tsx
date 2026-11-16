import type { TextareaHTMLAttributes } from 'react'
import { cn } from '../lib/cn'
import { fieldBase, fieldInvalid } from './Input'

export interface TextareaProps extends TextareaHTMLAttributes<HTMLTextAreaElement> {
  invalid?: boolean
}

/** Многострочное поле. */
export function Textarea({ invalid, rows = 4, className, ...props }: TextareaProps) {
  return (
    <textarea
      rows={rows}
      aria-invalid={invalid || undefined}
      readOnly={props.value !== undefined && !props.onChange}
      className={cn(
        'block resize-none rounded-md px-3 py-2 text-sm outline-none',
        fieldBase,
        'focus:border-accent focus:ring-[3px] focus:ring-ring',
        invalid && fieldInvalid,
        className
      )}
      {...props}
    />
  )
}
