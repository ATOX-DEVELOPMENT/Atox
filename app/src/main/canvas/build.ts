import { realpath } from 'node:fs/promises'
import { dirname, isAbsolute, relative, resolve } from 'node:path'
import type { BuildFailure, Message, Plugin } from 'esbuild'
import {
  CANVAS_ERROR_TOP_INSET,
  CANVAS_IMPORTABLE_PACKAGES,
  CANVAS_KIT_PACKAGE
} from '../../shared/canvasRuntime'
import { isInsideFolder } from './rules'

/**
 * Сборка экранов-React. Компилятор — нативный esbuild, а не esbuild-wasm: у wasm-версии
 * асинхронный API запускает отдельный Node (`#!/usr/bin/env node`), которого у пользователя
 * может не быть, а на главном потоке она блокировала бы приложение. Нативный бинарник
 * работает отдельным процессом; в собранном приложении он лежит в `app.asar.unpacked`
 * (`asarUnpack`), потому что исполняемый файл из архива не запустить.
 */

/** Экран, собранный в один ES-модуль. */
export interface ScreenBuild {
  js: string
  /** Стили из импортов экрана (`import './styles.css'`); пусто — нет. */
  css: string
  /** Файлы проекта, от которых зависит сборка: при их изменении экран собирается заново. */
  inputs: string[]
}

/** Сборка не удалась. Текст — для человека и агента: «файл:строка:столбец: что не так». */
export class ScreenBuildError extends Error {
  /** Файлы проекта, которые сборка успела найти: поправленный файл вернёт экран к жизни. */
  constructor(
    message: string,
    readonly inputs: string[]
  ) {
    super(message)
  }
}

export interface BuildRequest {
  /** Содержимое файла экрана: версия из истории собирается так же, как текущая. */
  source: string
  /** Путь к файлу экрана: от его папки считаются относительные импорты. */
  file: string
  /** Папки проекта: экран не импортирует ничего вне них. */
  roots: readonly string[]
  /** Файл, с которого собирается `@atox/ui`. */
  kit: string
}

const SCREEN_NAMESPACE = 'atox-screen'
const RUNTIME_NAMESPACE = 'atox-runtime'
const SCREEN_MODULE = 'atox:screen'
const RUNTIME_MODULE = 'atox:runtime'
/** Метка запроса, который плагин передал esbuild повторно: второй раз его не проверять. */
const FORWARDED = Symbol('forwarded')

/** Что страница делает с экраном: рисует его в `#root` и ловит падение отрисовки. */
const RUNTIME_SOURCE = `
import { createRoot } from 'react-dom/client'
import { Component, createElement as h } from 'react'

function ErrorCard({ error }) {
  const text = error instanceof Error ? error.message : String(error)
  return h('div', {
    style: {
      boxSizing: 'border-box', height: '100%', padding: '${CANVAS_ERROR_TOP_INSET}px 24px 24px', overflow: 'auto',
      background: '#fef2f2', color: '#7f1d1d', font: '14px/1.5 ui-monospace, Menlo, monospace'
    }
  },
    h('div', { style: { fontWeight: 700, fontSize: '16px', marginBottom: '8px' } }, 'This screen crashed'),
    h('div', { style: { whiteSpace: 'pre-wrap' } }, text)
  )
}

class Boundary extends Component {
  state = { error: null }
  static getDerivedStateFromError(error) { return { error } }
  componentDidCatch(error) { console.error(error) }
  render() {
    return this.state.error ? h(ErrorCard, { error: this.state.error }) : this.props.children
  }
}

export function mount(Screen) {
  createRoot(document.getElementById('root')).render(h(Boundary, null, h(Screen)))
}
`

const ENTRY_SOURCE = `
import Screen from '${SCREEN_MODULE}'
import { mount } from '${RUNTIME_MODULE}'
mount(Screen)
`

/** Картинки, шрифты и звуки встраиваются в экран: во внешние файлы он ходить не может. */
const EMBEDDED_LOADERS = {
  '.png': 'dataurl',
  '.jpg': 'dataurl',
  '.jpeg': 'dataurl',
  '.gif': 'dataurl',
  '.webp': 'dataurl',
  '.avif': 'dataurl',
  '.svg': 'dataurl',
  '.woff': 'dataurl',
  '.woff2': 'dataurl',
  '.ttf': 'dataurl',
  '.otf': 'dataurl'
} as const

function packageNotAvailable(name: string): string {
  return `Package "${name}" is not available on a canvas. You can use react, lucide-react, ${CANVAS_KIT_PACKAGE} and files from this project.`
}

/** Каждый импорт экрана проверяется: разрешённые пакеты, файлы только внутри проекта. */
function guard(request: BuildRequest, allowedRoots: readonly string[], found: Set<string>): Plugin {
  return {
    name: 'atox-canvas-guard',
    setup(build) {
      build.onResolve({ filter: /^atox:/ }, ({ path }) => {
        if (path === SCREEN_MODULE) {
          return { path: request.file, namespace: SCREEN_NAMESPACE }
        }
        return path === RUNTIME_MODULE ? { path, namespace: RUNTIME_NAMESPACE } : undefined
      })
      build.onLoad({ filter: /.*/, namespace: SCREEN_NAMESPACE }, () => ({
        contents: request.source,
        loader: request.file.toLowerCase().endsWith('.jsx') ? 'jsx' : 'tsx',
        resolveDir: dirname(request.file)
      }))
      build.onLoad({ filter: /.*/, namespace: RUNTIME_NAMESPACE }, () => ({
        contents: RUNTIME_SOURCE,
        loader: 'js',
        resolveDir: dirname(request.kit)
      }))
      build.onResolve({ filter: /.*/ }, async (args) => {
        if (args.kind === 'entry-point' || args.pluginData === FORWARDED) {
          return undefined
        }
        if (!args.path.startsWith('.') && !isAbsolute(args.path)) {
          if (args.path === CANVAS_KIT_PACKAGE) {
            return { path: request.kit }
          }
          // Сама страница тоже подключает react-dom/client: ей можно, экрану — нет.
          const ownImport = args.namespace === RUNTIME_NAMESPACE
          return CANVAS_IMPORTABLE_PACKAGES.has(args.path) || ownImport
            ? { path: args.path, external: true }
            : { errors: [{ text: packageNotAvailable(args.path) }] }
        }
        const resolved = await build.resolve(args.path, {
          kind: args.kind,
          importer: args.importer,
          namespace: args.namespace,
          resolveDir: args.resolveDir,
          pluginData: FORWARDED
        })
        if (resolved.errors.length > 0 || resolved.external) {
          return { errors: resolved.errors, warnings: resolved.warnings }
        }
        // Настоящий путь без символических ссылок: ссылка из проекта наружу — тоже выход.
        const real = await realpath(resolved.path).catch(() => resolved.path)
        if (!allowedRoots.some((root) => isInsideFolder(real, root))) {
          return {
            errors: [
              {
                text: `"${args.path}" is outside the project folder. A screen can only import files from its own project.`
              }
            ]
          }
        }
        found.add(real)
        return { path: real }
      })
    }
  }
}

/** Папки без символических ссылок: пути файлов сравниваются с ними тоже настоящими. */
function realFolders(folders: readonly string[]): Promise<string[]> {
  return Promise.all(folders.map((folder) => realpath(folder).catch(() => resolve(folder))))
}

/** Путь файла в ошибке — от папки проекта, как его видит агент. */
function shortPath(file: string, roots: readonly string[]): string {
  const root = roots.find((candidate) => isInsideFolder(file, candidate))
  return root ? relative(root, file) : file
}

function describeMessage(message: Message, screen: string, roots: readonly string[]): string {
  const { location, text } = message
  if (/No matching export/.test(text) && /for import "default"/.test(text)) {
    return `${shortPath(screen, roots)}: The file has no default export. A screen file must export a component: export default function Screen() { ... }`
  }
  if (!location) {
    return text
  }
  // Файл экрана esbuild называет с пространством имён: `atox-screen:/путь/к/файлу`.
  const file = resolve(dirname(screen), location.file.replace(`${SCREEN_NAMESPACE}:`, ''))
  return `${shortPath(file, roots)}:${location.line}:${location.column + 1}: ${text}`
}

/** Текст ошибок сборки: первая ошибка подробно, число остальных — в конце. */
export function describeBuildErrors(
  errors: readonly Message[],
  screen: string,
  roots: readonly string[]
): string {
  const [first, ...rest] = errors
  if (!first) {
    return 'The screen could not be built.'
  }
  const more = rest.length > 0 ? ` (+${rest.length} more ${rest.length === 1 ? 'error' : 'errors'})` : ''
  return `${describeMessage(first, screen, roots)}${more}`
}

/** Бинарник esbuild из `app.asar.unpacked`; вне архива esbuild находит его сам. */
function unpackedBinary(): string | undefined {
  try {
    const binary = require.resolve(`@esbuild/${process.platform}-${process.arch}/bin/esbuild`)
    return binary.includes('app.asar') ? binary.replace('app.asar', 'app.asar.unpacked') : undefined
  } catch {
    return undefined
  }
}

let esbuildModule: typeof import('esbuild') | undefined

/** esbuild читает путь к бинарнику при загрузке, поэтому подключается позже, чем он известен. */
function loadEsbuild(): typeof import('esbuild') {
  if (!esbuildModule) {
    const binary = unpackedBinary()
    if (binary) {
      process.env['ESBUILD_BINARY_PATH'] = binary
    }
    esbuildModule = require('esbuild') as typeof import('esbuild')
  }
  return esbuildModule
}

/** Собирает экран и всё, что он импортирует, в один ES-модуль. */
export async function buildScreen(request: BuildRequest): Promise<ScreenBuild> {
  const { build } = loadEsbuild()
  const roots = await realFolders(request.roots)
  const [kitRoot] = await realFolders([dirname(request.kit)])
  const screen = await realpath(request.file).catch(() => resolve(request.file))
  const base = dirname(screen)
  const found = new Set<string>()
  const projectFiles = () =>
    [screen, ...found].filter((file) => roots.some((root) => isInsideFolder(file, root)))
  try {
    const result = await build({
      stdin: { contents: ENTRY_SOURCE, sourcefile: 'atox:entry', resolveDir: base, loader: 'js' },
      bundle: true,
      write: false,
      outdir: 'out',
      format: 'esm',
      platform: 'browser',
      target: 'es2022',
      jsx: 'automatic',
      tsconfigRaw: '{}',
      absWorkingDir: base,
      logLevel: 'silent',
      legalComments: 'none',
      define: { 'process.env.NODE_ENV': '"production"' },
      loader: EMBEDDED_LOADERS,
      plugins: [guard({ ...request, file: screen }, [...roots, kitRoot!], found)]
    })
    const text = (extension: string): string =>
      result.outputFiles.find(({ path }) => path.endsWith(extension))?.text ?? ''
    return { js: text('.js'), css: text('.css'), inputs: projectFiles() }
  } catch (error) {
    const { errors } = error as Partial<BuildFailure>
    if (Array.isArray(errors)) {
      throw new ScreenBuildError(describeBuildErrors(errors, screen, roots), projectFiles())
    }
    throw error
  }
}
