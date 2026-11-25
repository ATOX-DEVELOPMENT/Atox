import type { ITerminalOptions } from '@xterm/xterm'

type TerminalAppearance = Required<Pick<ITerminalOptions, 'fontFamily' | 'fontSize' | 'theme'>>

/**
 * Оформление терминала берётся из CSS-переменных, чтобы цвета и шрифт задавались в одном
 * месте — в global.css — и следовали за светлой и тёмной темой.
 */
export function readTerminalAppearance(element: HTMLElement): TerminalAppearance {
  const styles = getComputedStyle(element)
  const token = (name: string) => styles.getPropertyValue(name).trim()
  const color = (name: string) => resolveColor(element, name)

  return {
    fontFamily: token('--font-mono'),
    fontSize: Number.parseFloat(token('--terminal-font-size')),
    theme: {
      background: color('--color-surface'),
      foreground: color('--color-text'),
      cursor: color('--color-text'),
      cursorAccent: color('--color-surface'),
      selectionBackground: color('--color-selection')
    }
  }
}

/**
 * Цвет из CSS-переменной в виде, который понимает xterm. Переменная может хранить не готовый
 * цвет, а выражение — `light-dark(…)` фона или `color-mix(…)` выделения, — и xterm такое не
 * разбирает: рисует чёрным. Браузер вычисляет выражение сам, если поставить его элементу цветом.
 */
function resolveColor(element: HTMLElement, name: string): string {
  const probe = document.createElement('span')
  probe.style.display = 'none'
  probe.style.color = `var(${name})`
  element.append(probe)
  const resolved = getComputedStyle(probe).color
  probe.remove()
  return resolved
}
