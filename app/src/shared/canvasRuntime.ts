/**
 * Что экран холста может подключать. Экраны собираются отдельно, а react, react-dom
 * и lucide-react лежат готовыми файлами (vendor), общими для всех экранов: страница
 * находит их по import map. Список нужен и сборке этих файлов, и сборке экранов.
 */

/** Пакеты, которые экран подключает как внешние: имя в `import` → файл в папке vendor. */
export const CANVAS_VENDOR_MODULES = {
  react: 'react.js',
  'react-dom': 'react-dom.js',
  'react-dom/client': 'react-dom-client.js',
  'react/jsx-runtime': 'react-jsx-runtime.js',
  'lucide-react': 'lucide-react.js'
} as const

export type CanvasVendorPackage = keyof typeof CANVAS_VENDOR_MODULES

/** Пакеты, которые разрешено импортировать из кода экрана; остальные — ошибка сборки. */
export const CANVAS_IMPORTABLE_PACKAGES: ReadonlySet<string> = new Set([
  'react',
  'react-dom',
  'react/jsx-runtime',
  'lucide-react'
])

/**
 * Отступ карточки ошибки сверху, в пикселях: в рамке телефона верх экрана закрывают «чёлка» и
 * статус-бар, и первая строка ошибки пряталась бы за ними.
 */
export const CANVAS_ERROR_TOP_INSET = 56

/** Набор компонентов Atox: собирается вместе с экраном, а не лежит среди vendor-файлов. */
export const CANVAS_KIT_PACKAGE = '@atox/ui'

/** Runtime-сборка Tailwind CSS v4 для браузера. */
export const CANVAS_TAILWIND_FILE = 'tailwind.js'

/** Папки с ресурсами холста в `resources/` (при разработке) и рядом с приложением (в сборке). */
export const CANVAS_VENDOR_DIRECTORY = 'canvas-vendor'
export const CANVAS_KIT_DIRECTORY = 'canvas-kit'

/** Файл кита, с которого он собирается, и его описание для агентов. */
export const CANVAS_KIT_ENTRY = 'index.ts'
export const CANVAS_KIT_GUIDE = 'GUIDE.md'
/** Готовые экраны на ките: агент открывает их, только когда нужен пример целиком. */
export const CANVAS_KIT_EXAMPLES = 'EXAMPLES.md'

/** Файл токенов кита (тема Tailwind): подставляется в страницу каждого экрана-React. */
export const CANVAS_KIT_TOKENS = 'tokens.css'
