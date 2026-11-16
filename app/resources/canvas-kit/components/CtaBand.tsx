import type { ReactNode } from 'react'
import { cn } from '../lib/cn'

export interface CtaBandProps {
  title: ReactNode
  description?: ReactNode
  actions: ReactNode
  /** accent: заливка акцентом; muted: спокойная плашка; inverse: тёмная плашка в светлой теме. */
  tone?: 'accent' | 'muted' | 'inverse'
  className?: string
}

const ctaTone = {
  accent: 'bg-accent text-accent-fg',
  muted: 'bg-muted text-fg border border-border',
  inverse: 'bg-inverse text-inverse-fg'
} as const

/** Плашка призыва к действию перед подвалом. */
export function CtaBand({ title, description, actions, tone = 'inverse', className }: CtaBandProps) {
  return (
    <section
      className={cn(
        'relative flex flex-col items-start justify-between gap-6 overflow-hidden rounded-3xl px-8 py-12 md:flex-row md:items-center md:px-12',
        ctaTone[tone],
        className
      )}
    >
      <div className="grid max-w-xl gap-2">
        <h2 className="text-3xl font-semibold text-balance">{title}</h2>
        {description && <p className="text-base opacity-75">{description}</p>}
      </div>
      <div className="flex shrink-0 flex-wrap items-center gap-3">{actions}</div>
    </section>
  )
}
