/**
 * Собирает файлы, которыми экраны холста пользуются без сети и без node_modules:
 * react, react-dom, lucide-react (ES-модули, общие для всех экранов) и runtime Tailwind CSS.
 * Результат — `resources/canvas-vendor`; запускается перед разработкой и сборкой:
 * `npm run build:vendor`.
 */
import { copyFile, mkdir, rm, writeFile } from 'node:fs/promises'
import { createRequire } from 'node:module'
import { join } from 'node:path'
import { build } from 'esbuild'
import {
  CANVAS_TAILWIND_FILE,
  CANVAS_VENDOR_DIRECTORY,
  CANVAS_VENDOR_MODULES,
  type CanvasVendorPackage
} from '../src/shared/canvasRuntime.ts'

const require = createRequire(import.meta.url)
const output = join(import.meta.dirname, '..', 'resources', CANVAS_VENDOR_DIRECTORY)
/** Временные точки входа: пишутся рядом с результатом и удаляются после сборки. */
const entries = join(output, '.entries')

/**
 * React — CommonJS, и браузер не увидит его имена как именованные экспорты. Точка входа
 * перечисляет их явно, по тому, что пакет экспортирует сейчас.
 */
function entrySource(name: CanvasVendorPackage): string {
  if (name === 'lucide-react') {
    return `export * from '${name}'\n`
  }
  const exported = Object.keys(require(name)).filter((key) => /^[A-Za-z_$][\w$]*$/.test(key))
  return [
    `import * as source from '${name}'`,
    ...exported.map((key) => `export const ${key} = source.${key}`),
    ''
  ].join('\n')
}

await rm(output, { recursive: true, force: true })
await mkdir(entries, { recursive: true })

const entryPoints: Record<string, string> = {}
for (const name of Object.keys(CANVAS_VENDOR_MODULES) as CanvasVendorPackage[]) {
  const file = join(entries, CANVAS_VENDOR_MODULES[name])
  await writeFile(file, entrySource(name))
  entryPoints[CANVAS_VENDOR_MODULES[name].replace(/\.js$/, '')] = file
}

// Одной сборкой с общими кусками: так react у react-dom и lucide-react — один и тот же.
await build({
  entryPoints,
  outdir: output,
  bundle: true,
  splitting: true,
  format: 'esm',
  platform: 'browser',
  target: 'es2022',
  minify: true,
  legalComments: 'none',
  define: { 'process.env.NODE_ENV': '"production"' },
  absWorkingDir: join(import.meta.dirname, '..')
})
await rm(entries, { recursive: true, force: true })
await copyFile(
  require.resolve('@tailwindcss/browser'),
  join(output, CANVAS_TAILWIND_FILE)
)
