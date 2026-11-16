import { Star } from 'lucide-react'
import { cn } from '../lib/cn'
import { Avatar } from './Avatar'

export interface TestimonialProps {
  quote: string
  name: string
  role: string
  /** Оценка звёздами из 5. */
  rating?: number
  className?: string
}

/** Отзыв клиента: цитата, автор с аватаром и должностью. */
export function Testimonial({ quote, name, role, rating, className }: TestimonialProps) {
  return (
    <figure className={cn('flex flex-col gap-5 rounded-2xl border border-border bg-surface p-6 shadow-xs', className)}>
      {rating !== undefined && (
        <div className="flex gap-0.5 text-warning" aria-label={`${rating} out of 5`}>
          {Array.from({ length: 5 }, (_, index) => (
            <Star key={index} aria-hidden size={16} strokeWidth={0} fill={index < rating ? 'currentColor' : 'var(--color-muted-strong)'} />
          ))}
        </div>
      )}
      <blockquote className="flex-1 text-base text-pretty text-fg">“{quote}”</blockquote>
      <figcaption className="flex items-center gap-3">
        <Avatar name={name} size="lg" />
        <span className="grid">
          <span className="text-sm font-semibold text-fg">{name}</span>
          <span className="text-sm text-fg-muted">{role}</span>
        </span>
      </figcaption>
    </figure>
  )
}
