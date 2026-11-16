/** Короткая запись числа для осей и подписей: 1.2k, 3.4M. */
export function formatCompact(value: number): string {
  const abs = Math.abs(value)
  if (abs >= 1_000_000) return `${trim(value / 1_000_000)}M`
  if (abs >= 1_000) return `${trim(value / 1_000)}k`
  return trim(value)
}

function trim(value: number): string {
  return Number.isInteger(value) ? String(value) : value.toFixed(1).replace(/\.0$/, '')
}

/** Первые буквы имени для аватара: "Maya Chen" → "MC". */
export function initials(name: string): string {
  const words = name.trim().split(/\s+/).filter(Boolean)
  const letters = words.length > 1 ? words[0][0] + words[words.length - 1][0] : name.slice(0, 2)
  return letters.toUpperCase()
}

/** Устойчивый индекс по строке: один и тот же человек всегда одного цвета. */
export function hashIndex(text: string, modulo: number): number {
  let hash = 0
  for (const char of text) hash = (hash * 31 + char.charCodeAt(0)) >>> 0
  return hash % modulo
}
