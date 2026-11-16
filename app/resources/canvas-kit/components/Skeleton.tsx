import { cn } from '../lib/cn'

export interface SkeletonProps {
  /** Размеры и форма задаются классами: "h-4 w-32", "size-10 rounded-full". */
  className?: string
}

/** Заглушка на время загрузки: мягко пульсирующий блок. */
export function Skeleton({ className }: SkeletonProps) {
  return <span aria-hidden className={cn('block animate-pulse rounded-md bg-muted-strong', className)} />
}

export interface SkeletonTextProps {
  lines?: number
  className?: string
}

/** Несколько строк текста-заглушки; последняя короче. */
export function SkeletonText({ lines = 3, className }: SkeletonTextProps) {
  return (
    <span role="status" aria-label="Loading" className={cn('grid gap-2', className)}>
      {Array.from({ length: lines }, (_, index) => (
        <Skeleton key={index} className={cn('h-3', index === lines - 1 && lines > 1 ? 'w-3/5' : 'w-full')} />
      ))}
    </span>
  )
}
