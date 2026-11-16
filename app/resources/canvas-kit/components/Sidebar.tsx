import type { ReactNode } from 'react'
import type { LucideIcon } from 'lucide-react'
import { cn } from '../lib/cn'
import { focusRing } from '../lib/tokens'
import { Kbd } from './Kbd'

export interface SidebarProps {
  /** Верх: Brand или переключатель рабочего пространства. */
  header?: ReactNode
  /** Низ: профиль, настройки, тариф. */
  footer?: ReactNode
  /** Узкая панель только с иконками. */
  collapsed?: boolean
  children: ReactNode
  className?: string
}

/** Боковая навигация приложения на всю высоту экрана. */
export function Sidebar({ header, footer, collapsed, children, className }: SidebarProps) {
  return (
    <aside
      data-collapsed={collapsed || undefined}
      className={cn(
        'group/sidebar flex h-full shrink-0 flex-col border-r border-border bg-canvas-subtle',
        collapsed ? 'w-16 items-center' : 'w-60',
        className
      )}
    >
      {header && <div className={cn('flex h-14 shrink-0 items-center', collapsed ? 'justify-center' : 'px-4')}>{header}</div>}
      <nav className={cn('flex min-h-0 flex-1 flex-col gap-5 overflow-y-auto py-2', collapsed ? 'px-2' : 'px-3')}>
        {children}
      </nav>
      {footer && <div className={cn('shrink-0 border-t border-border p-3', collapsed && 'px-2')}>{footer}</div>}
    </aside>
  )
}

export interface SidebarSectionProps {
  title?: string
  /** Кнопка справа от заголовка группы, например «+». */
  action?: ReactNode
  children: ReactNode
}

/** Группа пунктов боковой панели с заголовком. */
export function SidebarSection({ title, action, children }: SidebarSectionProps) {
  return (
    <div className="grid gap-0.5">
      {title && (
        <div className="flex h-7 items-center justify-between px-2 group-data-[collapsed]/sidebar:hidden">
          <span className="text-xs font-semibold text-fg-subtle">{title}</span>
          {action}
        </div>
      )}
      {children}
    </div>
  )
}

export interface SidebarItemProps {
  icon?: LucideIcon
  label: string
  active?: boolean
  /** Счётчик справа: число или уже отформатированная строка ("1,204"). */
  count?: number | string
  shortcut?: string[]
  /** Цветная точка вместо иконки: проекты, каналы. */
  dot?: string
  onClick?: () => void
}

/** Пункт боковой панели: иконка, подпись, счётчик; активный подсвечен. */
export function SidebarItem({ icon: Glyph, label, active, count, shortcut, dot, onClick }: SidebarItemProps) {
  return (
    <button
      type="button"
      title={label}
      aria-current={active ? 'page' : undefined}
      onClick={onClick}
      className={cn(
        'flex h-8 w-full cursor-pointer items-center gap-2.5 rounded-md px-2 text-sm transition-colors',
        'group-data-[collapsed]/sidebar:size-10 group-data-[collapsed]/sidebar:justify-center group-data-[collapsed]/sidebar:px-0',
        active
          ? 'bg-surface font-semibold text-fg shadow-xs ring-1 ring-border dark:bg-muted dark:ring-0'
          : 'text-fg-muted hover:bg-muted hover:text-fg',
        focusRing
      )}
    >
      {Glyph && (
        <Glyph aria-hidden size={16} strokeWidth={1.75} className={active ? 'text-fg' : 'text-fg-subtle'} />
      )}
      {!Glyph && dot && <span aria-hidden className="mx-1 size-2 shrink-0 rounded-full" style={{ background: dot }} />}
      <span className="flex-1 truncate text-left group-data-[collapsed]/sidebar:sr-only">{label}</span>
      {count !== undefined && (
        <span className="text-xs text-fg-subtle tabular-nums group-data-[collapsed]/sidebar:hidden">{count}</span>
      )}
      {shortcut && <Kbd keys={shortcut} className="group-data-[collapsed]/sidebar:hidden" />}
    </button>
  )
}
