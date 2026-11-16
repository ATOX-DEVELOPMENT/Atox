import { useLayoutEffect, useRef, type ReactNode } from 'react'

/**
 * Окно Atox. Под прозрачным сайдбаром у настоящего приложения — системный vibrancy, здесь его
 * замена (см. app-window.css). Прокрутка элементов, снятая со страницы (`data-scrolltop`),
 * возвращается после отрисовки.
 */
export function AppWindow({
  children,
  scheme,
  accent
}: {
  children: ReactNode
  /** Тема, в которой снят экран: от неё зависят все цвета. */
  scheme: 'light' | 'dark'
  /** Акцентный цвет из настроек; нет — стандартный. */
  accent?: string
}) {
  const ref = useRef<HTMLDivElement>(null)
  useLayoutEffect(() => {
    for (const element of ref.current?.querySelectorAll<HTMLElement>('[data-scrolltop]') ?? []) {
      element.scrollTop = Number(element.dataset['scrolltop'])
    }
  }, [])
  return (
    <div ref={ref} className="app-window" data-scheme={scheme} data-accent={accent}>
      {children}
      <span className="app-window__lights" aria-hidden>
        <i />
        <i />
        <i />
      </span>
    </div>
  )
}
