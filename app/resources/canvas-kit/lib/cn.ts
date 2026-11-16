/**
 * Склеивает классы и снимает конфликты Tailwind: из классов одной группы (w-*, bg-*,
 * text-размер, rounded-* ...) с одинаковыми вариантами остаётся последний. Так className,
 * переданный в компонент, всегда перекрывает его собственные классы.
 */
export function cn(...parts: Array<string | false | null | undefined>): string {
  const classes = parts.filter(Boolean).join(' ').split(/\s+/).filter(Boolean)
  const seen = new Set<string>()
  const kept: string[] = []
  for (let index = classes.length - 1; index >= 0; index--) {
    const name = classes[index]
    const key = conflictKey(name)
    if (seen.has(key)) continue
    seen.add(key)
    kept.push(name)
  }
  return kept.reverse().join(' ')
}

/** Утилиты, у которых одна группа на весь префикс. */
const PREFIX_GROUPS = [
  'min-w', 'min-h', 'max-w', 'max-h', 'size', 'w', 'h',
  'p', 'px', 'py', 'pt', 'pr', 'pb', 'pl', 'm', 'mx', 'my', 'mt', 'mr', 'mb', 'ml',
  'gap-x', 'gap-y', 'gap', 'space-x', 'space-y',
  'inset-x', 'inset-y', 'inset', 'top', 'right', 'bottom', 'left', 'z',
  'items', 'justify', 'content', 'self', 'place-items', 'place-content',
  'grid-cols', 'grid-rows', 'col-span', 'row-span', 'basis', 'order',
  'leading', 'tracking', 'opacity', 'cursor', 'whitespace', 'overflow-x', 'overflow-y',
  'overflow', 'object', 'translate-x', 'translate-y', 'rotate', 'scale', 'duration',
  'inset-shadow', 'shadow', 'blur', 'backdrop-blur', 'line-clamp', 'aspect', 'fill', 'stroke'
]

const DISPLAY = /^(block|inline-block|inline|flex|inline-flex|grid|inline-grid|hidden|contents|table)$/
const POSITION = /^(static|fixed|absolute|relative|sticky)$/
const FLEX_DIRECTION = /^flex-(row|col)(-reverse)?$/
const FLEX_SIZE = /^(flex-1|flex-auto|flex-none|flex-initial)$/
const TEXT_SIZE = /^text-(2xs|xs|sm|base|lg|\dxl|\[[\d.]+(px|rem|em)\])$/
const TEXT_WRAP = /^text-(wrap|nowrap|balance|pretty|ellipsis|clip)$/
const BG_IMAGE = /^bg-(linear|radial|conic|gradient|none$)/
const TEXT_ALIGN = /^text-(left|center|right|justify|start|end)$/
const FONT_WEIGHT = /^font-(thin|extralight|light|normal|medium|semibold|bold|extrabold|black)$/
const BORDER_WIDTH = /^border(-[xytrbl])?(-\d+|-\[[^\]]+px\])?$/
const BORDER_STYLE = /^border-(solid|dashed|dotted|double|none)$/
const RING_WIDTH = /^ring(-\d+|-\[[^\]]+px\])?$/
const ROUNDED = /^rounded(-(t|r|b|l|s|e|tl|tr|bl|br))?(-|$)/

/** Ключ конфликта: варианты (hover:, dark:, md:) плюс группа утилиты. */
function conflictKey(name: string): string {
  const cut = variantEnd(name)
  const variants = name.slice(0, cut)
  const base = name.slice(cut).replace(/^!|!$/g, '').replace(/^-/, '')
  return `${variants}${groupOf(base)}`
}

/** Конец префикса вариантов: последнее двоеточие вне квадратных скобок. */
function variantEnd(name: string): number {
  let depth = 0
  let end = 0
  for (let index = 0; index < name.length; index++) {
    const char = name[index]
    if (char === '[') depth++
    else if (char === ']') depth--
    else if (char === ':' && depth === 0) end = index + 1
  }
  return end
}

function groupOf(base: string): string {
  if (DISPLAY.test(base)) return 'display'
  if (POSITION.test(base)) return 'position'
  if (FLEX_DIRECTION.test(base)) return 'flex-direction'
  if (FLEX_SIZE.test(base)) return 'flex-size'
  if (TEXT_SIZE.test(base)) return 'text-size'
  if (TEXT_ALIGN.test(base)) return 'text-align'
  if (TEXT_WRAP.test(base)) return 'text-wrap'
  if (base.startsWith('text-')) return 'text-color'
  if (FONT_WEIGHT.test(base)) return 'font-weight'
  if (base.startsWith('font-')) return 'font-family'
  if (BORDER_STYLE.test(base)) return 'border-style'
  const borderWidth = base.match(BORDER_WIDTH)
  if (borderWidth) return `border-width${borderWidth[1] ?? ''}`
  if (base.startsWith('border-')) return 'border-color'
  if (RING_WIDTH.test(base)) return 'ring-width'
  if (base.startsWith('ring-offset')) return base
  if (base.startsWith('ring-')) return 'ring-color'
  const rounded = base.match(ROUNDED)
  if (rounded) return `rounded${rounded[1] ?? ''}`
  if (BG_IMAGE.test(base)) return 'bg-image'
  if (base.startsWith('bg-')) return 'bg'
  const dash = base.lastIndexOf('-')
  for (let end = dash; end > 0; end = base.lastIndexOf('-', end - 1)) {
    const prefix = base.slice(0, end)
    if (PREFIX_GROUPS.includes(prefix)) return prefix
  }
  return base
}
