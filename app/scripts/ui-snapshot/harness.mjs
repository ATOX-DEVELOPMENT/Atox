/**
 * Управление окном Atox по CDP: запуск собранного приложения с демо-профилем, настоящие клики
 * мышью, ожидание, снимок текущего интерфейса в JSX.
 */
import { spawn } from 'node:child_process'
import { mkdir, readFile, writeFile } from 'node:fs/promises'
import { dirname } from 'node:path'

const sleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms))

/** Запускает приложение (нужна сборка: `npm run build`) и ждёт, пока окно ответит по CDP. */
export async function launch({ appDirectory, userData, port, env = {} }) {
  const child = spawn(
    'npx',
    ['electron', '.', `--user-data-dir=${userData}`, `--remote-debugging-port=${port}`],
    { cwd: appDirectory, stdio: 'ignore', env: { ...process.env, ...env } }
  )
  for (let attempt = 0; attempt < 120; attempt++) {
    await sleep(500)
    try {
      const targets = await (await fetch(`http://127.0.0.1:${port}/json`)).json()
      const page = targets.find((target) => target.type === 'page' && target.url.startsWith('file:'))
      if (page) {
        const window = await connect(page.webSocketDebuggerUrl)
        // Окно должно нарисовать сайдбар, прежде чем с ним что-то делать.
        await window.waitFor('.sidebar', 20000)
        return { window, stop: () => child.kill() }
      }
    } catch {
      // приложение ещё запускается
    }
  }
  child.kill()
  throw new Error('Atox did not start')
}

/** Окно приложения: клики, ожидание, снимок. */
export async function connect(url) {
  const socket = new WebSocket(url)
  let nextId = 0
  const pending = new Map()
  socket.onmessage = ({ data }) => {
    const message = JSON.parse(data)
    const call = pending.get(message.id)
    if (call) {
      pending.delete(message.id)
      message.error ? call.reject(new Error(JSON.stringify(message.error))) : call.resolve(message.result)
    }
  }
  await new Promise((resolve, reject) => {
    socket.onopen = resolve
    socket.onerror = reject
  })
  const send = (method, params = {}) =>
    new Promise((resolve, reject) => {
      const id = ++nextId
      pending.set(id, { resolve, reject })
      socket.send(JSON.stringify({ id, method, params }))
    })

  /** Выполняет выражение в окне; бросает, если оно упало. */
  const evaluate = async (expression) => {
    const { result, exceptionDetails } = await send('Runtime.evaluate', {
      expression,
      awaitPromise: true,
      returnByValue: true
    })
    if (exceptionDetails) {
      throw new Error(exceptionDetails.exception?.description ?? exceptionDetails.text)
    }
    return result.value
  }

  const api = {
    send,
    evaluate,
    sleep,
    /** Размер окна страницы в CSS-пикселях; снимки делаются при 1200 x 780, как окно приложения. */
    async resize(width = 1200, height = 780) {
      await send('Emulation.setDeviceMetricsOverride', { width, height, deviceScaleFactor: 1, mobile: false })
    },
    /** Ждёт, пока элемент (CSS-селектор) появится. */
    async waitFor(selector, timeout = 8000) {
      const until = Date.now() + timeout
      while (Date.now() < until) {
        if (await evaluate(`!!document.querySelector(${JSON.stringify(selector)})`)) {
          return
        }
        await sleep(100)
      }
      throw new Error(`Timed out waiting for ${selector}`)
    },
    /** Центр элемента: по селектору, при `text` — первого, чей текст содержит эту строку. */
    async center(selector, text) {
      const point = await evaluate(`(() => {
        const text = ${JSON.stringify(text ?? null)}
        const matches = [...document.querySelectorAll(${JSON.stringify(selector)})]
        const el = text === null ? matches[0] : matches.find((node) => node.textContent.includes(text))
        if (!el) return null
        el.scrollIntoView({ block: 'nearest' })
        const box = el.getBoundingClientRect()
        return { x: box.left + box.width / 2, y: box.top + box.height / 2 }
      })()`)
      if (!point) {
        throw new Error(`No element ${selector}${text ? ` with "${text}"` : ''}`)
      }
      return point
    },
    /** Настоящий клик мышью (кнопка 0 — левая, 2 — правая): так работают и onPointerDown. */
    async click(selector, { text, button = 'left' } = {}) {
      const { x, y } = await api.center(selector, text)
      await send('Input.dispatchMouseEvent', { type: 'mouseMoved', x, y })
      for (const type of ['mousePressed', 'mouseReleased']) {
        await send('Input.dispatchMouseEvent', {
          type,
          x,
          y,
          button,
          buttons: button === 'right' ? 2 : 1,
          clickCount: 1
        })
      }
      await sleep(250)
    },
    /** Наводит мышь на элемент: появляются подсказки и кнопки, видимые только при наведении. */
    async hover(selector, text) {
      const { x, y } = await api.center(selector, text)
      await send('Input.dispatchMouseEvent', { type: 'mouseMoved', x, y })
      await sleep(250)
    },
    /** Вводит текст в сфокусированное поле. */
    async type(text) {
      await send('Input.insertText', { text })
      await sleep(150)
    },
    async key(key, modifiers = 0) {
      for (const type of ['keyDown', 'keyUp']) {
        await send('Input.dispatchKeyEvent', { type, key, modifiers })
      }
      await sleep(200)
    },
    /** Прокручивает элемент до конца (диалог в чате показывает последние сообщения). */
    async scrollToEnd(selector) {
      await evaluate(`(() => { const el = document.querySelector(${JSON.stringify(selector)}); if (el) el.scrollTop = el.scrollHeight })()`)
      await sleep(200)
    },
    /** JSX всего, что сейчас в окне, и то, что живёт вне `#root`: акцент и тема. */
    async snapshot() {
      const source = await readFile(new URL('./dom-to-jsx.js', import.meta.url), 'utf8')
      const jsx = await evaluate(source)
      const meta = await evaluate(`({
        accent: document.documentElement.dataset.accent ?? null,
        scheme: matchMedia('(prefers-color-scheme: dark)').matches ? 'dark' : 'light'
      })`)
      return { jsx, ...meta }
    },
    /** Скриншот настоящего окна (PNG) — сверить снимок глазами. Сайдбар на нём чёрный: окно прозрачное. */
    async screenshot(file) {
      const { data } = await send('Page.captureScreenshot', { format: 'png' })
      await mkdir(dirname(file), { recursive: true })
      await writeFile(file, Buffer.from(data, 'base64'))
    },
    close: () => socket.close()
  }
  return api
}

/** Пишет экран: общий CSS приложения, окно-обёртка и снимок интерфейса. */
export async function writeScreen({ file, jsx, accent, scheme }) {
  const props = `scheme="${scheme}"${accent ? ` accent="${accent}"` : ''}`
  const source = `import './app.css'
import './app-window.css'
import { AppWindow } from './AppWindow'

export default function Screen() {
  return (
    <AppWindow ${props}>
${jsx}
    </AppWindow>
  )
}
`
  await mkdir(dirname(file), { recursive: true })
  await writeFile(file, source)
}
