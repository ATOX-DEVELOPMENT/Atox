import { cn } from '../lib/cn'
import { hashIndex, initials } from '../lib/format'

export type AvatarSize = 'xs' | 'sm' | 'md' | 'lg' | 'xl'

export interface AvatarProps {
  /** Полное имя: из него берутся инициалы и устойчивый цвет. */
  name: string
  /** Картинка из файлов проекта или data URI; внешние адреса не грузятся. */
  src?: string
  size?: AvatarSize
  status?: 'online' | 'away' | 'busy' | 'offline'
  /** Квадрат со скруглением: для команд и компаний. */
  square?: boolean
  className?: string
}

const sizeClass: Record<AvatarSize, string> = {
  xs: 'size-5 text-[9px]',
  sm: 'size-6 text-2xs',
  md: 'size-8 text-xs',
  lg: 'size-10 text-sm',
  xl: 'size-14 text-lg'
}

const statusSize: Record<AvatarSize, string> = {
  xs: 'size-1.5',
  sm: 'size-2',
  md: 'size-2.5',
  lg: 'size-3',
  xl: 'size-3.5'
}

/** Приглушённые пары фон/текст: читаются в обеих темах и не спорят с акцентом. */
const palette = [
  'bg-[#e0e7ff] text-[#3730a3] dark:bg-[#312e81] dark:text-[#c7d2fe]',
  'bg-[#dcfce7] text-[#166534] dark:bg-[#14532d] dark:text-[#bbf7d0]',
  'bg-[#fef3c7] text-[#92400e] dark:bg-[#78350f] dark:text-[#fde68a]',
  'bg-[#fce7f3] text-[#9d174d] dark:bg-[#831843] dark:text-[#fbcfe8]',
  'bg-[#e0f2fe] text-[#075985] dark:bg-[#0c4a6e] dark:text-[#bae6fd]',
  'bg-[#ede9fe] text-[#5b21b6] dark:bg-[#4c1d95] dark:text-[#ddd6fe]',
  'bg-[#ffedd5] text-[#9a3412] dark:bg-[#7c2d12] dark:text-[#fed7aa]',
  'bg-[#f4f4f5] text-[#3f3f46] dark:bg-[#3f3f46] dark:text-[#e4e4e7]'
]

const statusColor = {
  online: 'bg-success',
  away: 'bg-warning',
  busy: 'bg-danger',
  offline: 'bg-gray-400'
} as const

/** Аватар: фото или инициалы на устойчивом цвете, с точкой статуса. */
export function Avatar({ name, src, size = 'md', status, square, className }: AvatarProps) {
  const shape = square ? 'rounded-[28%]' : 'rounded-full'
  return (
    <span className={cn('relative inline-flex shrink-0', className)}>
      {src ? (
        <img src={src} alt={name} className={cn('object-cover', shape, sizeClass[size])} />
      ) : (
        <span
          role="img"
          aria-label={name}
          className={cn(
            'grid place-items-center font-semibold select-none',
            shape,
            sizeClass[size],
            palette[hashIndex(name, palette.length)]
          )}
        >
          {initials(name)}
        </span>
      )}
      {status && (
        <span
          aria-label={status}
          className={cn(
            'absolute right-0 bottom-0 rounded-full ring-2 ring-canvas',
            statusSize[size],
            statusColor[status]
          )}
        />
      )}
    </span>
  )
}

export interface AvatarGroupProps {
  names: string[]
  /** Сколько показать до «+N». */
  max?: number
  size?: AvatarSize
  className?: string
}

/** Стопка аватаров участников с остатком «+N». */
export function AvatarGroup({ names, max = 4, size = 'md', className }: AvatarGroupProps) {
  const shown = names.slice(0, max)
  const rest = names.length - shown.length
  return (
    <div className={cn('flex items-center -space-x-1.5', className)}>
      {shown.map((name) => (
        <Avatar key={name} name={name} size={size} className="rounded-full ring-2 ring-canvas" />
      ))}
      {rest > 0 && (
        <span
          className={cn(
            'relative grid place-items-center rounded-full bg-muted-strong font-semibold text-fg-muted ring-2 ring-canvas',
            sizeClass[size]
          )}
        >
          +{rest}
        </span>
      )}
    </div>
  )
}
