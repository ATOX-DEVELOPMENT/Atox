/** Геометрия графиков без библиотек: шкалы, «красивые» деления и гладкие кривые. */

export interface Point {
  x: number
  y: number
}

/** Цвета серий по порядку: первая всегда акцент. Переменные --atox-* берутся напрямую, чтобы учитывать тему и акцент ветки. */
export const seriesColor = [
  'var(--atox-accent)',
  'var(--atox-chart-2)',
  'var(--atox-chart-3)',
  'var(--atox-chart-4)',
  'var(--atox-chart-5)'
]

/** Цвет по тону набора для одиночных графиков. */
export const toneColor = {
  accent: 'var(--atox-accent)',
  success: 'var(--atox-success)',
  warning: 'var(--atox-warning)',
  danger: 'var(--atox-danger)',
  info: 'var(--atox-info)',
  neutral: 'var(--atox-fg-subtle)'
} as const

export type ChartTone = keyof typeof toneColor

/** Деления оси от нуля до округлённого максимума: 0, 250, 500, 750, 1000. */
export function niceTicks(max: number, count = 4): number[] {
  if (max <= 0) return [0, 1]
  const raw = max / count
  const magnitude = 10 ** Math.floor(Math.log10(raw))
  const step = [1, 2, 2.5, 5, 10].map((m) => m * magnitude).find((s) => s >= raw) ?? raw
  const top = Math.ceil(max / step) * step
  return Array.from({ length: Math.round(top / step) + 1 }, (_, index) => index * step)
}

/**
 * Гладкая кривая через точки (монотонная кубическая, Фрич и Карлсон): не выходит
 * за значения данных, поэтому не рисует ложных пиков и провалов.
 */
export function smoothPath(points: Point[]): string {
  if (points.length === 0) return ''
  if (points.length === 1) return `M${points[0].x},${points[0].y}`
  const n = points.length
  const dx: number[] = []
  const slope: number[] = []
  for (let i = 0; i < n - 1; i++) {
    dx.push(points[i + 1].x - points[i].x)
    slope.push((points[i + 1].y - points[i].y) / dx[i])
  }
  const tangent = [slope[0]]
  for (let i = 1; i < n - 1; i++) {
    tangent.push(slope[i - 1] * slope[i] <= 0 ? 0 : (slope[i - 1] + slope[i]) / 2)
  }
  tangent.push(slope[n - 2])
  for (let i = 0; i < n - 1; i++) {
    if (slope[i] === 0) {
      tangent[i] = 0
      tangent[i + 1] = 0
      continue
    }
    const a = tangent[i] / slope[i]
    const b = tangent[i + 1] / slope[i]
    const h = a * a + b * b
    if (h > 9) {
      const t = 3 / Math.sqrt(h)
      tangent[i] = t * a * slope[i]
      tangent[i + 1] = t * b * slope[i]
    }
  }
  let d = `M${points[0].x},${points[0].y}`
  for (let i = 0; i < n - 1; i++) {
    const p0 = points[i]
    const p1 = points[i + 1]
    const third = dx[i] / 3
    d += ` C${p0.x + third},${p0.y + tangent[i] * third} ${p1.x - third},${p1.y - tangent[i + 1] * third} ${p1.x},${p1.y}`
  }
  return d
}

/** Точки ряда в координатах viewBox: x от 0 до width, y сверху вниз от 0 до height. */
export function toPoints(data: number[], width: number, height: number, min: number, max: number): Point[] {
  const span = max - min || 1
  const stepX = data.length > 1 ? width / (data.length - 1) : 0
  return data.map((value, index) => ({
    x: index * stepX,
    y: height - ((value - min) / span) * height
  }))
}
