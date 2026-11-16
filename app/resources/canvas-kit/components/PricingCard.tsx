import type { ReactNode } from 'react'
import { Check } from 'lucide-react'
import { cn } from '../lib/cn'

export interface PricingCardProps {
  name: string
  /** Цена без периода: "$24", "Free", "Custom". */
  price: string
  period?: string
  description?: string
  features: string[]
  /** Кнопка тарифа; у выделенного тарифа primary, у остальных secondary. */
  cta: ReactNode
  /** Рекомендуемый тариф: рамка акцента и метка. */
  featured?: boolean
  badge?: string
  className?: string
}

/** Карточка тарифа: название, цена, список возможностей и кнопка. */
export function PricingCard({
  name,
  price,
  period,
  description,
  features,
  cta,
  featured,
  badge,
  className
}: PricingCardProps) {
  return (
    <div
      className={cn(
        'relative flex flex-col gap-6 rounded-2xl border bg-surface p-6',
        featured ? 'border-accent shadow-lg ring-1 ring-accent' : 'border-border shadow-xs',
        className
      )}
    >
      <div className="grid gap-2">
        <div className="flex items-center justify-between gap-3">
          <h3 className="text-base font-semibold text-fg">{name}</h3>
          {badge && (
            <span className="rounded-full bg-accent-soft px-2 py-0.5 text-xs font-semibold text-accent-text">{badge}</span>
          )}
        </div>
        {description && <p className="text-sm text-fg-muted">{description}</p>}
      </div>
      <div className="flex items-baseline gap-1">
        <span className="text-4xl font-semibold text-fg tabular-nums">{price}</span>
        {period && <span className="text-sm text-fg-muted">{period}</span>}
      </div>
      {cta}
      <ul className="grid gap-3 border-t border-border pt-6 text-sm">
        {features.map((feature) => (
          <li key={feature} className="flex items-start gap-2.5 text-fg">
            <Check aria-hidden size={16} strokeWidth={2} className="mt-0.5 shrink-0 text-accent-text" />
            {feature}
          </li>
        ))}
      </ul>
    </div>
  )
}
