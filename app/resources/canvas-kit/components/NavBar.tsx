import type { ReactNode } from 'react'
import { ChevronLeft } from 'lucide-react'
import { cn } from '../lib/cn'
import { focusRing } from '../lib/tokens'

export interface NavBarProps {
  title?: ReactNode
  /** Крупный заголовок под строкой кнопок, как на корневых экранах iOS. */
  large?: boolean
  subtitle?: ReactNode
  /** Подпись кнопки «назад»; true рисует только стрелку. */
  back?: string | boolean
  onBack?: () => void
  /** Кнопки справа: IconButton, текстовая кнопка. */
  actions?: ReactNode
  /** Нижняя линия, когда содержимое прокручено под шапку. */
  bordered?: boolean
  /** Строка поиска или сегменты под заголовком. */
  children?: ReactNode
  className?: string
}

/** Шапка мобильного экрана: назад, заголовок по центру или крупный, действия справа. */
export function NavBar({
  title,
  large,
  subtitle,
  back,
  onBack,
  actions,
  bordered,
  children,
  className
}: NavBarProps) {
  return (
    <header className={cn('shrink-0', bordered && 'border-b border-border', className)}>
      <div className="relative flex h-11 items-center justify-between px-4">
        <div className="flex min-w-0 items-center">
          {back && (
            <button
              type="button"
              onClick={onBack}
              className={cn('-ml-2 flex h-11 cursor-pointer items-center rounded-md pr-2 text-lg text-accent-text', focusRing)}
            >
              <ChevronLeft aria-hidden size={28} strokeWidth={2} />
              {typeof back === 'string' && <span className="-ml-1">{back}</span>}
            </button>
          )}
        </div>
        {!large && title && (
          <div className="pointer-events-none absolute inset-x-24 grid text-center">
            <span className="truncate text-[17px] font-semibold text-fg">{title}</span>
            {subtitle && <span className="truncate text-xs text-fg-muted">{subtitle}</span>}
          </div>
        )}
        <div className="flex items-center gap-1 text-accent-text">{actions}</div>
      </div>
      {large && title && (
        <div className="grid gap-0.5 px-4 pt-1 pb-2">
          <h1 className="text-[34px] leading-[41px] font-semibold tracking-[-0.02em] text-fg">{title}</h1>
          {subtitle && <p className="text-sm text-fg-muted">{subtitle}</p>}
        </div>
      )}
      {children && <div className="px-4 pb-3">{children}</div>}
    </header>
  )
}
