import type { CSSProperties } from 'react'

/** Лепестки знака Atox: цвет и угол каждого, как в иконке приложения. */
const PETALS = [
  { color: '#ff6a3d', angle: 0 },
  { color: '#2f7dff', angle: 60 },
  { color: '#a24dff', angle: 120 }
] as const

/** Знак Atox: при появлении лепестки раскрываются из одного в цветок. */
function BloomMark() {
  const petals = PETALS.map(({ color, angle }, index) => (
    <ellipse
      key={color}
      className="bloom-mark__petal"
      cx="50"
      cy="50"
      rx="13"
      ry="29"
      fill={color}
      style={{ '--petal-angle': `${angle}deg`, '--petal-index': index } as CSSProperties}
    />
  ))
  return (
    <svg className="bloom-mark" viewBox="0 0 100 100" aria-hidden>
      <g className="bloom-mark__glow">{petals}</g>
      <g className="bloom-mark__petals">{petals}</g>
    </svg>
  )
}

/** Пустая рабочая область: только знак Atox по центру. */
export function Welcome() {
  return <BloomMark />
}
