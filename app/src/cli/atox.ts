/**
 * Команда `atox` для агентов в терминалах Atox: запустить помощника в соседнем чате,
 * написать ему или своему агенту, отчитаться о работе, показать экраны на холсте чата.
 * Запускается бинарником Electron
 * в режиме Node и передаёт команду приложению через его локальный сокет.
 */
import { createConnection } from 'node:net'
import { resolve } from 'node:path'
import { SCREEN_DEVICES } from '../shared/canvas'
import {
  OrchestrationEnv,
  PARENT_ADDRESS,
  type OrchestrationMethod,
  type OrchestrationMethods,
  type OrchestrationResponse
} from '../shared/orchestration'

const DEVICE_IDS = Object.keys(SCREEN_DEVICES).join('|')

const USAGE = `Usage: atox <command>

Delegate work to another agent in a new Atox chat in the same folder.

  atox agents                              List installed agents
  atox models <agent>                      List the agent's models and their effort levels
  atox start <agent> [--title <name>] [--model <id>] [--effort <level>] <task>
                                           Start a worker agent with a task; its report
                                           arrives in your chat as a new message.
                                           Without --model/--effort the worker uses the
                                           user's model for new chats.
                                           Pass "-" as the task to read it from stdin.
  atox workers                             List your workers
  atox send <chat-id|${PARENT_ADDRESS}> <message>     Message one of your workers, or your parent agent
  atox remove <chat-id> [<chat-id>...]     Stop workers and remove their chats
  atox report <summary>                    Worker: report the result to the parent agent

Show screens (app, website, desktop UI) to the user on this chat's canvas.

  atox canvas                              Show this chat's canvas and its screens
  atox canvas screen set <name> <file.tsx|.jsx|.html> [--device ${DEVICE_IDS}] [--size WxH]
                                           Put a React component (default export) or an HTML
                                           file on the canvas as a screen, or update the screen
                                           with that name. Then just edit the files: the canvas
                                           rebuilds by itself. Prints build errors, runtime
                                           errors and layout problems.
  atox canvas screen preview <name>        Render the screen to a PNG and print its path, so you
                                           can open the image and check your work. Also reports
                                           build errors, runtime errors and content that does
                                           not fit the screen.
  atox canvas screen remove <name>         Remove a screen from the canvas (the file stays)
  atox canvas link <from> <to> [--label "Tap Sign in"] [--on "Sign in"]
                                           Draw an arrow from one screen to another so the user
                                           sees what follows what. --on starts the arrow at a
                                           button of the "from" screen (its text or a CSS
                                           selector); without it the arrow starts at the screen.
                                           Run it again for the same pair to change the label.
  atox canvas link remove <from> <to> [--on "Sign in"]
                                           Remove the arrows between two screens (or only the one
                                           that starts at that button)
  atox canvas export <pdf|png|pptx> [--screens "Name,Name"] [--out <path>]
                                           Export the screens to a file for the user to send or
                                           print: pdf (one page per screen, real text), pptx
                                           (one slide per screen, as images) or png (a folder
                                           of images). Pages go in canvas order: rows top to
                                           bottom, left to right. Default: the Downloads folder.

Works only for agents running in Atox chats.`

/** Сколько ждать ответа приложения: команды выполняются сразу и не ждут работы агентов. */
const RESPONSE_TIMEOUT_MS = 30_000

class UsageError extends Error {}

async function main(args: string[]): Promise<string> {
  const [command, ...rest] = args
  switch (command) {
    case 'agents': {
      const agents = await call('agents', {})
      return agents.length > 0
        ? agents.map(({ id, name }) => `${id}\t${name}`).join('\n')
        : 'No agents are installed.'
    }
    case 'models': {
      const [agent] = rest
      if (!agent) {
        throw new UsageError('Specify the agent, for example: atox models claude')
      }
      const { defaultModel, models } = await call('models', { agent })
      return models
        .map(({ id, name, efforts, defaultEffort }) => {
          const marks = id === defaultModel ? ' (default)' : ''
          const levels = efforts
            .map((level) => (level === defaultEffort ? `${level}*` : level))
            .join(', ')
          return `${id}\t${name}${marks}\t${levels ? `effort: ${levels}` : 'no effort levels'}`
        })
        .join('\n')
    }
    case 'start': {
      const { values, positional } = parseFlags(rest, ['title', 'model', 'effort'])
      const [agent, ...taskWords] = positional
      if (!agent) {
        throw new UsageError('Specify the agent, for example: atox start claude "<task>"')
      }
      const task = await readText(taskWords, 'task')
      const worker = await call('start', {
        agent,
        task,
        title: values['title'],
        model: values['model'],
        effort: values['effort']
      })
      return `Started worker "${worker.title}" (chat ${worker.chatId}${describeModel(worker)}). Its report will arrive in this chat as a new message; you can keep working meanwhile.`
    }
    case 'workers': {
      const workers = await call('workers', {})
      return workers.length > 0
        ? workers
            .map((worker) => {
              const { chatId, title, agent, running, reported, startedAt } = worker
              const state = reported ? 'reported' : running ? 'working' : 'stopped'
              return `${chatId}\t${agent}${describeModel(worker)}\t${state}\tstarted ${formatAge(startedAt)}\t${title}`
            })
            .join('\n')
        : 'You have no workers.'
    }
    case 'send': {
      const [to, ...messageWords] = rest
      if (!to) {
        throw new UsageError(`Specify the recipient: a worker chat id or "${PARENT_ADDRESS}".`)
      }
      await call('send', { to, message: await readText(messageWords, 'message') })
      return 'Message sent. The agent gets it as soon as it can take input.'
    }
    case 'remove': {
      if (rest.length === 0) {
        throw new UsageError('Specify the chat ids of the workers to remove (see atox workers).')
      }
      const { removed } = await call('remove', { chatIds: rest })
      return removed.length === 1
        ? `Removed worker ${removed[0]}.`
        : `Removed ${removed.length} workers: ${removed.join(', ')}.`
    }
    case 'report': {
      await call('report', { summary: await readText(rest, 'summary') })
      return 'Report sent to the parent agent. Your task is complete; stop here.'
    }
    case 'canvas':
      return canvas(rest)
    case undefined:
    case 'help':
    case '--help':
    case '-h':
      return USAGE
    default:
      throw new UsageError(`Unknown command: ${command}\n\n${USAGE}`)
  }
}

const CANVAS_SET_COMMAND = 'atox canvas screen set <name> <file.tsx> [--device <device>]'

const CANVAS_SET_USAGE = `Usage: ${CANVAS_SET_COMMAND} [--size WxH]. Quote names with spaces.`

interface ScreenProblems {
  buildError: string | null
  runtimeErrors: string[]
  layout: string[]
}

/** Что не так с экраном, словами: агент правит файлы по этим строкам. */
function describeProblems({ buildError, runtimeErrors, layout }: ScreenProblems): string[] {
  const section = (title: string, lines: string[]) =>
    lines.length > 0 ? [title, ...lines.map((line) => `- ${line}`)] : []
  return [
    ...(buildError
      ? [
          `Build failed: ${buildError}`,
          'The canvas keeps the last version that built. Fix the file; it rebuilds by itself.'
        ]
      : []),
    ...section('Errors in the running screen (fix them):', runtimeErrors),
    ...section('Layout problems (fix them in the screen):', layout)
  ]
}

/** `atox canvas …`: холст чата и его экраны. */
async function canvas(args: string[]): Promise<string> {
  const [group, action, ...rest] = args
  if (group === undefined) {
    const shown = await call('canvas', {})
    if (!shown) {
      return `This chat has no canvas yet. Add a screen with: ${CANVAS_SET_COMMAND}`
    }
    const count = shown.screens.length === 1 ? '1 screen' : `${shown.screens.length} screens`
    const lines = shown.screens.map(
      ({ name, device, width, height, file, missing, buildError }) =>
        `${name}\t${device} ${width}x${height}\t${file}${missing ? '\tfile missing' : ''}${buildError ? `\tbuild failed: ${buildError}` : ''}`
    )
    const arrows = shown.links.map(
      ({ from, to, label, on }) =>
        `${from} -> ${to}${on ? `\tfrom "${on}"` : ''}${label ? `\t${label}` : ''}`
    )
    return [
      `Canvas "${shown.name}", ${count}. Edit a screen's file and the canvas updates by itself.`,
      ...lines,
      ...(arrows.length > 0 ? ['Arrows:', ...arrows] : [])
    ].join('\n')
  }
  if (group === 'screen' && action === 'set') {
    const { values, positional } = parseFlags(rest, ['device', 'size'])
    const [name, file] = positional
    if (!name || !file || positional.length > 2) {
      throw new UsageError(CANVAS_SET_USAGE)
    }
    const result = await call('canvasScreenSet', {
      name,
      // Путь считается от папки, в которой агент запустил команду.
      file: resolve(file),
      ...(values['device'] !== undefined && { device: values['device'] }),
      ...(values['size'] !== undefined && { size: values['size'] })
    })
    const look = `${result.device}, ${result.width}x${result.height}`
    const done = result.created
      ? `Added the screen "${result.screen}" (${look}) to the canvas "${result.canvas}". The user sees it now.`
      : `Updated the screen "${result.screen}" (${look}) on the canvas "${result.canvas}".`
    return [
      [
        ...(result.canvasCreated ? [`Created the canvas "${result.canvas}" for this chat.`] : []),
        done,
        `From now on just edit ${result.file} (and the files it imports): the canvas updates by itself. Run this command again only to change the device or size.`
      ].join(' '),
      ...describeProblems(result)
    ].join('\n')
  }
  if (group === 'screen' && action === 'preview') {
    const name = rest.join(' ')
    if (!name.trim()) {
      throw new UsageError('Usage: atox canvas screen preview <name>')
    }
    const preview = await call('canvasScreenPreview', { name })
    return [`Screenshot of "${preview.screen}": ${preview.path}`, ...describeProblems(preview)].join(
      '\n'
    )
  }
  if (group === 'screen' && action === 'remove') {
    const name = rest.join(' ')
    if (!name.trim()) {
      throw new UsageError('Usage: atox canvas screen remove <name>')
    }
    const { screen } = await call('canvasScreenRemove', { name })
    return `Removed the screen "${screen}" from the canvas. Its file stays in the project.`
  }
  if (group === 'link') {
    const removing = action === 'remove'
    const { values, positional } = parseFlags(removing ? rest : [action, ...rest].filter((part) => part !== undefined), [
      'label',
      'on'
    ])
    const [from, to] = positional
    if (!from || !to || positional.length > 2) {
      throw new UsageError(
        removing
          ? 'Usage: atox canvas link remove <from> <to> [--on "Sign in"]'
          : 'Usage: atox canvas link <from> <to> [--label "Tap Sign in"] [--on "Sign in"]'
      )
    }
    if (removing) {
      const { removed } = await call('canvasLinkRemove', {
        from,
        to,
        ...(values['on'] !== undefined && { on: values['on'] })
      })
      return removed === 0
        ? `There was no arrow from "${from}" to "${to}".`
        : `Removed ${removed === 1 ? '1 arrow' : `${removed} arrows`} from "${from}" to "${to}".`
    }
    const result = await call('canvasLinkSet', {
      from,
      to,
      ...(values['label'] !== undefined && { label: values['label'] }),
      ...(values['on'] !== undefined && { on: values['on'] })
    })
    const route = `"${result.from}" -> "${result.to}"`
    return [
      `${result.created ? 'Added' : 'Updated'} the arrow ${route}${result.on ? ` from "${result.on}"` : ''}${result.label ? `, labelled "${result.label}"` : ''}.`,
      ...(result.elementMissing
        ? [
            `Warning: no visible element "${result.on}" on "${result.from}", so the arrow starts at the screen. Use the exact text of the button or a CSS selector, and run the command again.`
          ]
        : [])
    ].join('\n')
  }
  if (group === 'export') {
    const { values, positional } = parseFlags([action, ...rest].filter((part) => part !== undefined), [
      'screens',
      'out'
    ])
    const [format] = positional
    if (!format || positional.length > 1) {
      throw new UsageError('Usage: atox canvas export <pdf|png|pptx> [--screens "Name,Name"] [--out <path>]')
    }
    const names = values['screens']
      ?.split(',')
      .map((name) => name.trim())
      .filter(Boolean)
    const result = await call('canvasExport', {
      format,
      ...(names && names.length > 0 && { screens: names }),
      // Путь считается от папки, в которой агент запустил команду.
      ...(values['out'] !== undefined && { out: resolve(values['out']) })
    })
    const count = result.screens === 1 ? '1 screen' : `${result.screens} screens`
    const what = result.format === 'png' ? 'folder' : 'file'
    return [
      `Exported ${count} as ${result.format.toUpperCase()}: ${result.path}`,
      `Tell the user where the ${what} is; Atox does not open it.`,
      ...result.warnings.map((warning) => `Warning: ${warning}`)
    ].join('\n')
  }
  throw new UsageError(`Unknown canvas command.\n\n${USAGE}`)
}

/** «, opus, high» — модель и эффорт помощника, если они заданы. */
function describeModel({ model, effort }: { model?: string; effort?: string }): string {
  return [model, effort].map((part) => (part ? `, ${part}` : '')).join('')
}

/** Сколько времени прошло с момента: «just now», «5m ago», «2h ago», «3d ago». */
function formatAge(timestamp: number): string {
  const minutes = Math.floor((Date.now() - timestamp) / 60_000)
  if (minutes < 1) {
    return 'just now'
  }
  if (minutes < 60) {
    return `${minutes}m ago`
  }
  const hours = Math.floor(minutes / 60)
  return hours < 24 ? `${hours}h ago` : `${Math.floor(hours / 24)}d ago`
}

/** Значения флагов `--name value` и остальные аргументы по порядку. */
function parseFlags(
  args: string[],
  names: string[]
): { values: Record<string, string>; positional: string[] } {
  const values: Record<string, string> = {}
  const positional: string[] = []
  for (let index = 0; index < args.length; index++) {
    const name = args[index]!.replace(/^--/, '')
    if (args[index]!.startsWith('--') && names.includes(name)) {
      const value = args[++index]
      if (value === undefined) {
        throw new UsageError(`--${name} needs a value.`)
      }
      values[name] = value
    } else {
      positional.push(args[index]!)
    }
  }
  return { values, positional }
}

/**
 * Текст из аргументов; «-» — читать stdin. Без явного «-» stdin не читается: у инструментов
 * агентов он бывает открытым каналом, который никогда не закроется.
 */
async function readText(words: string[], name: string): Promise<string> {
  const fromStdin = words.length === 1 && words[0] === '-'
  const text = fromStdin ? await readStdin() : words.join(' ')
  if (!text.trim()) {
    throw new UsageError(`The ${name} is empty.`)
  }
  return text
}

async function readStdin(): Promise<string> {
  const chunks: Buffer[] = []
  for await (const chunk of process.stdin) {
    chunks.push(chunk as Buffer)
  }
  return Buffer.concat(chunks).toString('utf8')
}

function call<Method extends OrchestrationMethod>(
  method: Method,
  params: OrchestrationMethods[Method]['params']
): Promise<OrchestrationMethods[Method]['result']> {
  const socketPath = process.env[OrchestrationEnv.Socket]
  const token = process.env[OrchestrationEnv.Token]
  const chatId = process.env[OrchestrationEnv.ChatId]
  if (!socketPath || !token || !chatId) {
    return Promise.reject(
      new Error('atox works only for agents running in Atox chats.')
    )
  }

  return new Promise((resolve, reject) => {
    const socket = createConnection(socketPath)
    let response = ''
    socket.setEncoding('utf8')
    socket.setTimeout(RESPONSE_TIMEOUT_MS, () => {
      socket.destroy()
      reject(new Error('Atox did not respond. Make sure the app is running.'))
    })
    socket.on('connect', () =>
      socket.write(`${JSON.stringify({ token, chatId, method, params })}\n`)
    )
    socket.on('data', (chunk: string) => (response += chunk))
    socket.on('error', (error: NodeJS.ErrnoException) =>
      reject(
        new Error(
          error.code === 'ENOENT' || error.code === 'ECONNREFUSED'
            ? 'Atox is not running.'
            : `Could not connect to Atox (${error.code ?? error.message}). If a sandbox blocks it, run the command again with elevated permissions.`
        )
      )
    )
    socket.on('end', () => {
      try {
        const parsed = JSON.parse(response) as OrchestrationResponse<Method>
        if (parsed.ok) {
          resolve(parsed.result)
        } else {
          reject(new Error(parsed.error))
        }
      } catch {
        reject(new Error('Atox returned an invalid response.'))
      }
    })
  })
}

main(process.argv.slice(2)).then(
  (output) => {
    process.stdout.write(`${output}\n`)
  },
  (error: unknown) => {
    process.stderr.write(`atox: ${error instanceof Error ? error.message : String(error)}\n`)
    process.exitCode = error instanceof UsageError ? 2 : 1
  }
)
