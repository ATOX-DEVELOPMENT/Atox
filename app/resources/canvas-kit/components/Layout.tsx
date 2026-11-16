import type { HTMLAttributes } from 'react'
import { cn } from '../lib/cn'

/** Шаг отступа в единицах Tailwind (4px): 2 = 8px, 4 = 16px, 6 = 24px. */
export type Gap = 0 | 1 | 2 | 3 | 4 | 5 | 6 | 8 | 10 | 12 | 16

const gapClass: Record<Gap, string> = {
  0: 'gap-0',
  1: 'gap-1',
  2: 'gap-2',
  3: 'gap-3',
  4: 'gap-4',
  5: 'gap-5',
  6: 'gap-6',
  8: 'gap-8',
  10: 'gap-10',
  12: 'gap-12',
  16: 'gap-16'
}

const alignClass = {
  start: 'items-start',
  center: 'items-center',
  end: 'items-end',
  stretch: 'items-stretch',
  baseline: 'items-baseline'
} as const

const justifyClass = {
  start: 'justify-start',
  center: 'justify-center',
  end: 'justify-end',
  between: 'justify-between'
} as const

export interface StackProps extends HTMLAttributes<HTMLDivElement> {
  gap?: Gap
  align?: keyof typeof alignClass
  justify?: keyof typeof justifyClass
}

/** Колонка с ровным шагом между детьми. */
export function Stack({ gap = 4, align, justify, className, ...props }: StackProps) {
  return (
    <div
      className={cn(
        'flex flex-col',
        gapClass[gap],
        align && alignClass[align],
        justify && justifyClass[justify],
        className
      )}
      {...props}
    />
  )
}

export interface RowProps extends StackProps {
  wrap?: boolean
}

/** Строка с ровным шагом; по умолчанию выравнивает по центру. */
export function Row({ gap = 3, align = 'center', justify, wrap, className, ...props }: RowProps) {
  return (
    <div
      className={cn(
        'flex flex-row',
        gapClass[gap],
        alignClass[align],
        justify && justifyClass[justify],
        wrap && 'flex-wrap',
        className
      )}
      {...props}
    />
  )
}

const colsClass = {
  1: 'grid-cols-1',
  2: 'grid-cols-2',
  3: 'grid-cols-3',
  4: 'grid-cols-4',
  5: 'grid-cols-5',
  6: 'grid-cols-6',
  12: 'grid-cols-12'
} as const

export interface GridProps extends HTMLAttributes<HTMLDivElement> {
  cols?: keyof typeof colsClass
  gap?: Gap
}

/** Сетка из равных колонок. */
export function Grid({ cols = 3, gap = 4, className, ...props }: GridProps) {
  return <div className={cn('grid', colsClass[cols], gapClass[gap], className)} {...props} />
}

const containerClass = {
  sm: 'max-w-xl',
  md: 'max-w-3xl',
  lg: 'max-w-5xl',
  xl: 'max-w-6xl',
  full: 'max-w-none'
} as const

export interface ContainerProps extends HTMLAttributes<HTMLDivElement> {
  size?: keyof typeof containerClass
}

/** Центрированная колонка страницы с боковыми полями. */
export function Container({ size = 'xl', className, ...props }: ContainerProps) {
  return (
    <div className={cn('mx-auto w-full px-6 md:px-8', containerClass[size], className)} {...props} />
  )
}
