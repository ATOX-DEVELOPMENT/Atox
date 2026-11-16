import type { ReactNode } from 'react'
import { cn } from '../lib/cn'
import { Container } from './Layout'

export interface HeroProps {
  /** Метка над заголовком: Badge «New» с текстом. */
  eyebrow?: ReactNode
  title: ReactNode
  description?: ReactNode
  actions?: ReactNode
  /** Мелкий текст под кнопками: «Free for 14 days. No card required.» */
  note?: ReactNode
  align?: 'center' | 'left'
  /** Визуал под текстом (по центру) или справа (по левому краю): скрин продукта из компонентов. */
  children?: ReactNode
  className?: string
}

/** Первый экран лендинга: метка, крупный заголовок, описание, действия и визуал. */
export function Hero({ eyebrow, title, description, actions, note, align = 'center', children, className }: HeroProps) {
  const centered = align === 'center'
  const text = (
    <div className={cn('grid gap-6', centered ? 'mx-auto max-w-3xl justify-items-center text-center' : 'max-w-xl')}>
      {eyebrow}
      <h1 className="font-display text-5xl font-semibold text-balance text-fg md:text-6xl">{title}</h1>
      {description && <p className="max-w-2xl text-lg text-pretty text-fg-muted">{description}</p>}
      {actions && <div className="mt-2 flex flex-wrap items-center gap-3">{actions}</div>}
      {note && <p className="text-sm text-fg-subtle">{note}</p>}
    </div>
  )
  return (
    <section className={cn('relative overflow-hidden py-20 md:py-24', className)}>
      <div
        aria-hidden
        className="pointer-events-none absolute inset-x-0 -top-40 -z-10 mx-auto h-[480px] max-w-4xl rounded-full bg-accent/15 blur-3xl"
      />
      <Container>
        {centered ? (
          <div className="grid gap-16">
            {text}
            {children}
          </div>
        ) : (
          <div className="grid items-center gap-12 md:grid-cols-2">
            {text}
            {children}
          </div>
        )}
      </Container>
    </section>
  )
}
