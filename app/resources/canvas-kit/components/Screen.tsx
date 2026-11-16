import type { HTMLAttributes } from 'react'
import { cn } from '../lib/cn'
import type { Accent } from '../lib/tokens'

export interface ScreenProps extends HTMLAttributes<HTMLDivElement> {
  /** Тема экрана; без значения берётся тема кадра. */
  mode?: 'light' | 'dark'
  accent?: Accent
  /** Фон: canvas для страниц, subtle для дашбордов и сгруппированных списков. */
  background?: 'canvas' | 'subtle'
  /**
   * app: высота кадра, шапка и нижняя панель на месте, прокручивается только ScrollArea.
   * page: документ растёт вниз и прокручивается целиком (лендинги, длинные страницы).
   */
  layout?: 'app' | 'page'
  /** Отступы под системные области телефона, если на экране нет StatusBar и HomeIndicator. */
  inset?: boolean
}

/**
 * Корень каждого экрана: заполняет кадр устройства (без 100vh), задаёт шрифт, цвет и фон.
 * Внутри обычно колонка: шапка, прокручиваемое содержимое с `flex-1`, нижняя панель.
 */
export function Screen({
  mode,
  accent,
  background = 'canvas',
  layout = 'app',
  inset = false,
  className,
  children,
  ...props
}: ScreenProps) {
  return (
    <div
      data-accent={accent}
      className={cn(
        mode,
        'relative isolate flex min-h-full w-full flex-col font-sans text-fg antialiased',
        layout === 'app' && 'h-full overflow-hidden',
        background === 'canvas' ? 'bg-canvas' : 'bg-canvas-subtle',
        inset && 'pt-[54px] pb-[34px]',
        className
      )}
      {...props}
    >
      {children}
    </div>
  )
}

export type ScrollAreaProps = HTMLAttributes<HTMLDivElement>

/** Прокручиваемая середина экрана в раскладке app: занимает всё место между шапкой и панелью. */
export function ScrollArea({ className, ...props }: ScrollAreaProps) {
  return (
    <div
      className={cn(
        'min-h-0 flex-1 overflow-y-auto overscroll-contain [scrollbar-width:none] [&::-webkit-scrollbar]:hidden',
        className
      )}
      {...props}
    />
  )
}
