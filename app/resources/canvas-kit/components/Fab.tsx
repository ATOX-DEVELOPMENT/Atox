import type { ButtonHTMLAttributes } from 'react'
import type { LucideIcon } from 'lucide-react'
import { cn } from '../lib/cn'
import { focusRing } from '../lib/tokens'

export interface FabProps extends ButtonHTMLAttributes<HTMLButtonElement> {
  icon: LucideIcon
  /** Подпись для чтения с экрана; при extended видна рядом с иконкой. */
  label: string
  extended?: boolean
  /** Прижать к правому нижнему углу над панелью вкладок; родитель relative. */
  floating?: boolean
}

/** Плавающая кнопка главного действия на телефоне. */
export function Fab({ icon: Glyph, label, extended, floating, type = 'button', className, ...props }: FabProps) {
  return (
    <button
      type={type}
      aria-label={label}
      className={cn(
        'inline-flex h-14 cursor-pointer items-center justify-center gap-2 rounded-full bg-accent text-accent-fg shadow-lg transition-colors hover:bg-accent-hover',
        extended ? 'px-6 text-base font-semibold' : 'w-14',
        floating && 'absolute right-5 bottom-[108px] z-20',
        focusRing,
        className
      )}
      {...props}
    >
      <Glyph aria-hidden size={24} strokeWidth={2} />
      {extended && label}
    </button>
  )
}
