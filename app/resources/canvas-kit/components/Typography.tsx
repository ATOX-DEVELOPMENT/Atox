import type { ElementType, HTMLAttributes } from 'react'
import { cn } from '../lib/cn'

const headingSize = {
  display: 'text-5xl font-semibold md:text-6xl',
  h1: 'text-3xl font-semibold',
  h2: 'text-2xl font-semibold',
  h3: 'text-xl font-semibold',
  h4: 'text-lg font-semibold',
  h5: 'text-base font-semibold'
} as const

export type HeadingSize = keyof typeof headingSize

export interface HeadingProps extends HTMLAttributes<HTMLHeadingElement> {
  /** Ступень шкалы: display для героя, h1 для заголовка страницы, h3 для карточек. */
  size?: HeadingSize
  /** HTML-тег; по умолчанию выводится из size. */
  as?: 'h1' | 'h2' | 'h3' | 'h4' | 'h5' | 'h6' | 'p'
}

/** Заголовок по шкале набора: один вес (semibold), трекинг из токенов. */
export function Heading({ size = 'h2', as, className, ...props }: HeadingProps) {
  const Tag: ElementType = as ?? (size === 'display' ? 'h1' : size)
  return (
    <Tag
      className={cn('font-display text-balance text-fg', headingSize[size], className)}
      {...props}
    />
  )
}

const textSize = {
  xs: 'text-xs',
  sm: 'text-sm',
  base: 'text-base',
  lg: 'text-lg',
  xl: 'text-xl'
} as const

const textTone = {
  default: 'text-fg',
  muted: 'text-fg-muted',
  subtle: 'text-fg-subtle',
  accent: 'text-accent-text',
  success: 'text-success-text',
  danger: 'text-danger-text'
} as const

export interface TextProps extends HTMLAttributes<HTMLElement> {
  size?: keyof typeof textSize
  tone?: keyof typeof textTone
  /** Два веса на весь набор: regular для текста, semibold для акцента. */
  weight?: 'regular' | 'semibold'
  as?: 'p' | 'span' | 'div' | 'label'
  /** Цифры одинаковой ширины: суммы, время, таблицы. */
  numeric?: boolean
}

/** Основной текст: размер, тон и вес только из шкалы набора. */
export function Text({
  size = 'sm',
  tone = 'default',
  weight = 'regular',
  as: Tag = 'p',
  numeric,
  className,
  ...props
}: TextProps) {
  return (
    <Tag
      className={cn(
        textSize[size],
        textTone[tone],
        weight === 'semibold' && 'font-semibold',
        numeric && 'tabular-nums',
        className
      )}
      {...props}
    />
  )
}
