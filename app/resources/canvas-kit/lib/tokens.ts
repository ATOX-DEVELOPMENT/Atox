/** Общие типы и классы, на которых держатся все компоненты набора. */

/** Смысловой тон: цвет подложки, текста и иконок. */
export type Tone = 'neutral' | 'accent' | 'success' | 'warning' | 'danger' | 'info'

/** Акцентные палитры из tokens.css. */
export type Accent = 'indigo' | 'blue' | 'emerald' | 'rose' | 'amber' | 'violet'

/** Кольцо фокуса с клавиатуры: одно на весь набор. */
export const focusRing =
  'outline-none focus-visible:ring-[3px] focus-visible:ring-ring focus-visible:ring-offset-0'

/** Мягкая подложка и текст по тону: бейджи, иконки в плашках, уведомления. */
export const softTone: Record<Tone, string> = {
  neutral: 'bg-muted text-fg-muted',
  accent: 'bg-accent-soft text-accent-text',
  success: 'bg-success-soft text-success-text',
  warning: 'bg-warning-soft text-warning-text',
  danger: 'bg-danger-soft text-danger-text',
  info: 'bg-info-soft text-info-text'
}

/** Сплошная заливка по тону. */
export const solidTone: Record<Tone, string> = {
  neutral: 'bg-inverse text-inverse-fg',
  accent: 'bg-accent text-accent-fg',
  success: 'bg-success text-white',
  warning: 'bg-warning text-gray-950',
  danger: 'bg-danger text-white',
  info: 'bg-info text-white'
}

/** Текст по тону. */
export const textTone: Record<Tone, string> = {
  neutral: 'text-fg-muted',
  accent: 'text-accent-text',
  success: 'text-success-text',
  warning: 'text-warning-text',
  danger: 'text-danger-text',
  info: 'text-info-text'
}

/** Фон полосы или точки по тону: прогресс, статус, легенда. */
export const fillTone: Record<Tone, string> = {
  neutral: 'bg-fg-subtle',
  accent: 'bg-accent',
  success: 'bg-success',
  warning: 'bg-warning',
  danger: 'bg-danger',
  info: 'bg-info'
}
