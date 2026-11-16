import { cn } from '../lib/cn'

export interface StatusBarProps {
  time?: string
  /** Цвет значков: auto берёт цвет текста темы, light для тёмного фона под ним, dark для светлого. */
  tone?: 'auto' | 'light' | 'dark'
  /** Батарея в процентах. */
  battery?: number
  /** Нарисовать Dynamic Island, если рамка устройства его не рисует. */
  island?: boolean
  className?: string
}

const toneClass = { auto: 'text-fg', light: 'text-white', dark: 'text-gray-950' } as const

/** Строка состояния iPhone: время, сеть, Wi-Fi и батарея (54px), фон прозрачный. */
export function StatusBar({
  time = '9:41',
  tone = 'auto',
  battery = 82,
  island = false,
  className
}: StatusBarProps) {
  const level = Math.min(100, Math.max(0, battery))
  return (
    <div
      aria-hidden
      className={cn(
        'relative flex h-[54px] shrink-0 items-center justify-between px-8 pt-1.5',
        toneClass[tone],
        className
      )}
    >
      <span className="w-[54px] text-center text-[17px] font-semibold tracking-tight tabular-nums">{time}</span>
      {island && <span className="absolute top-[11px] left-1/2 h-[37px] w-[125px] -translate-x-1/2 rounded-full bg-black" />}
      <span className="flex items-center gap-[6px]">
        <svg width="18" height="12" viewBox="0 0 18 12" fill="currentColor">
          <rect x="0" y="7.5" width="3" height="4.5" rx="1" />
          <rect x="5" y="5" width="3" height="7" rx="1" />
          <rect x="10" y="2.5" width="3" height="9.5" rx="1" />
          <rect x="15" y="0" width="3" height="12" rx="1" />
        </svg>
        <svg width="16" height="12" viewBox="0 0 16 12" fill="currentColor">
          <path d="M8 2.4c2.3 0 4.4.9 6 2.4l1.1-1.2A10.2 10.2 0 0 0 8 .8 10.2 10.2 0 0 0 .9 3.6L2 4.8a8.6 8.6 0 0 1 6-2.4Z" />
          <path d="M8 5.6c1.4 0 2.6.5 3.6 1.4l1.1-1.2A6.9 6.9 0 0 0 8 4a6.9 6.9 0 0 0-4.7 1.8L4.4 7c1-.9 2.2-1.4 3.6-1.4Z" />
          <path d="M8 8.8c.6 0 1.1.2 1.5.6L8 11.2 6.5 9.4c.4-.4.9-.6 1.5-.6Z" />
        </svg>
        <span className="relative flex h-[13px] w-[27px] items-center rounded-[4.3px] border border-current/40 p-[1.5px]">
          <span className="h-full rounded-[2.5px] bg-current" style={{ width: `${level}%` }} />
          <span className="absolute -right-[3.5px] h-[4px] w-[1.5px] rounded-r-sm bg-current/40" />
        </span>
      </span>
    </div>
  )
}
