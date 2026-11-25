import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import { IS_MAC } from '../../shared/platform'
import { findSurface, type Settings } from '../../shared/settings'
import { App } from './App'
import { trackWindowFocus } from './lib/windowFocus'
import './styles/global.css'

const container = document.getElementById('root')

if (!container) {
  throw new Error('Root element #root not found')
}

// Оформление окна различается: на macOS — прозрачный сайдбар и кнопки окна в нём.
document.documentElement.dataset['platform'] = IS_MAC ? 'mac' : 'linux'
// Акцентный цвет и фон задаются до первой отрисовки, чтобы окно не мигало прежними.
const applyAppearance = ({ accent, surface }: Pick<Settings, 'accent' | 'surface'>) => {
  const root = document.documentElement
  root.dataset['accent'] = accent
  const { light, dark } = findSurface(surface)
  root.style.setProperty('--color-surface', `light-dark(${light}, ${dark})`)
}
applyAppearance(window.atox.settings.get())
window.atox.settings.subscribe(applyAppearance)
trackWindowFocus()

createRoot(container).render(
  <StrictMode>
    <App />
  </StrictMode>
)
