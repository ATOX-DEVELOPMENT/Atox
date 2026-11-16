/**
 * Снимает интерфейс Atox в экраны холста: запускает собранное приложение с демо-профилем,
 * проводит окно по состояниям из `states/` и пишет каждое в `.atox/canvas/app/<id>.tsx`
 * (React с настоящими классами и настоящим `global.css`). Потом ставит экраны на холст чата.
 *
 *   npm run build                         # приложение должно быть собрано
 *   node scripts/ui-snapshot/run.mjs      # все состояния
 *   node scripts/ui-snapshot/run.mjs --only chat,settings --port 9333 --profile /tmp/my-profile
 *
 * Параллельные запуски (несколько агентов) берут свои `--port` и `--profile`.
 */
import { execFileSync } from 'node:child_process'
import { copyFile, mkdir, readFile, readdir, writeFile } from 'node:fs/promises'
import { dirname, join, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'
import { buildDemoProfile } from './demo-profile.mjs'
import { launch, writeScreen } from './harness.mjs'

const here = dirname(fileURLToPath(import.meta.url))
const appDirectory = resolve(here, '..', '..')
const repoRoot = resolve(appDirectory, '..')
const screensDirectory = join(repoRoot, '.atox', 'canvas', 'app')
const globalCss = join(appDirectory, 'src', 'renderer', 'src', 'styles', 'global.css')

function option(name, fallback) {
  const index = process.argv.indexOf(`--${name}`)
  return index === -1 ? fallback : process.argv[index + 1]
}

const only = option('only', '')?.split(',').filter(Boolean)
const port = Number(option('port', '9333'))
const profile = option('profile', `/tmp/atox-demo-profile-${port}`)
const placeOnCanvas = !process.argv.includes('--no-canvas')
const shotsDirectory = `/tmp/atox-shots-${port}`

/** Состояния всех файлов из `states/`: `{ id, group, title, size?, run(window) }`. */
async function loadStates() {
  const states = []
  for (const name of (await readdir(join(here, 'states'))).sort()) {
    if (name.endsWith('.mjs')) {
      const module = await import(`./states/${name}`)
      states.push(...module.states.map((state) => ({ group: name.replace('.mjs', ''), ...state })))
    }
  }
  return states
}

/**
 * CSS приложения для экрана холста. У окна приложения тема и акцент живут на `<html>`, а тема —
 * ещё и в `prefers-color-scheme`; экран же один из многих на холсте, и у каждого своя тема. Поэтому
 * `:root` становится `.app-window`, а тёмный блок — вариантом `[data-scheme='dark']`.
 */
function appCss(source) {
  const marker = '@media (prefers-color-scheme: dark) {'
  const start = source.indexOf(marker)
  let css = source
  if (start !== -1) {
    let depth = 0
    let end = start + marker.length - 1
    for (; end < source.length; end++) {
      depth += source[end] === '{' ? 1 : source[end] === '}' ? -1 : 0
      if (depth === 0) {
        break
      }
    }
    const inner = source.slice(start + marker.length, end).replaceAll(':root', ".app-window[data-scheme='dark']")
    css = source.slice(0, start) + inner + source.slice(end + 1)
  }
  return css.replaceAll(':root', '.app-window')
}

async function ensureWindowFiles() {
  await mkdir(screensDirectory, { recursive: true })
  await writeFile(join(screensDirectory, 'app.css'), appCss(await readFile(globalCss, 'utf8')))
  for (const name of ['AppWindow.tsx', 'app-window.css']) {
    await copyFile(join(here, 'window', name), join(screensDirectory, name))
  }
}

const states = (await loadStates()).filter(({ id }) => !only?.length || only.includes(id))
if (states.length === 0) {
  throw new Error('No states matched')
}
await ensureWindowFiles()
const done = []
const placeOnly = process.argv.includes('--place-only')
// Репозитории демо-проектов у каждого запуска свои: параллельные запуски не мешают друг другу.
process.env['ATOX_DEMO_REPOSITORIES'] ??= `/tmp/atox-demo-${port}`
const demo = placeOnly ? null : await buildDemoProfile(profile)
const app = placeOnly ? null : await launch({ appDirectory, userData: demo.profile, port, env: demo.env })
if (placeOnly) {
  const existing = new Set((await readdir(screensDirectory)).map((name) => name.replace(/\.tsx$/, '')))
  done.push(...states.filter(({ id }) => existing.has(id)))
}
try {
  for (const state of placeOnly ? [] : states) {
    process.stdout.write(`${state.id} ... `)
    try {
      await app.window.send('Page.reload')
      await app.window.sleep(600)
      await app.window.waitFor('.sidebar', 20000)
      await app.window.resize()
      await app.window.sleep(400)
      await state.run(app.window)
      const snapshot = await app.window.snapshot()
      await writeScreen({ file: join(screensDirectory, `${state.id}.tsx`), ...snapshot })
      // Скриншот настоящего окна — сверить глазами, не трогая холст.
      await app.window.screenshot(join(shotsDirectory, `${state.id}.png`))
      done.push(state)
      console.log('ok')
    } catch (error) {
      console.log(`FAILED: ${error.message.split('\n')[0]}`)
    }
  }
} finally {
  app?.window.close()
  app?.stop()
}

if (placeOnCanvas && done.length > 0) {
  const atox = (...args) => execFileSync('atox', args, { cwd: repoRoot, encoding: 'utf8' })
  for (const state of done) {
    const [width, height] = state.size ?? [1200, 780]
    atox('canvas', 'screen', 'set', state.title, join('.atox', 'canvas', 'app', `${state.id}.tsx`), '--size', `${width}x${height}`)
  }
  // Ряды по смыслу — из layout.mjs; состояния, которых там нет, уходят в последний ряд.
  const { rows: layout } = await import('./layout.mjs')
  const titles = new Map(done.map((state) => [state.id, state.title]))
  const rows = layout
    .map((ids) => ids.flatMap((id) => titles.get(id) ?? []))
    .filter((row) => row.length > 0)
  try {
    atox('canvas', 'arrange', ...rows.map((row) => row.join(',')))
  } catch {
    console.log('This Atox has no `canvas arrange` yet: screens stay in one row until it is updated.')
  }
console.log(`Placed ${done.length} screens on the canvas.`)
}
