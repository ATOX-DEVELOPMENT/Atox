/**
 * Данные для состояний группы chat: проект Harbor с чатами на каждый вид записей ленты (ответ
 * с разметкой, запрос разрешения, вопрос агента, сжатие, ошибка, отчёты `/context` и `/usage`,
 * смена агента, вложения, очередь), пустой чат, чаты в архиве — и поддельный Anthropic API.
 *
 * Поддельный API нужен трём состояниям, которые нельзя положить в файл: когда агент работает,
 * ждёт разрешения или ждёт ответа на вопрос, — при загрузке ленты такие записи закрываются.
 * Встроенный Claude Code ходит за ответами на `ANTHROPIC_BASE_URL` из `.claude/settings.json`
 * проекта: сервер отвечает по сценарию (по тексту первого сообщения) и по числу ответов агента
 * в запросе. Каждое состояние пишет в свой чат, поэтому ответы не мешают друг другу.
 *
 * Применяется, когда запускается вся съёмка или хотя бы одно состояние `chat-*`.
 */
import { createServer } from 'node:http'
import { access, mkdir, rm, writeFile } from 'node:fs/promises'
import { join } from 'node:path'
import { deflateSync } from 'node:zlib'

const HOUR = 3_600_000
const base = Date.UTC(2026, 10, 16, 9, 0, 0)

function wanted() {
  const index = process.argv.indexOf('--only')
  if (index === -1) {
    return true
  }
  return (process.argv[index + 1] ?? '').split(',').some((id) => id.startsWith('chat-'))
}

// --- Записи ленты --------------------------------------------------------------------------

let counter = 100
const id = () => `h-${String(++counter).padStart(4, '0')}`

const user = (text, minutes, extra = {}) => ({
  kind: 'user',
  id: id(),
  text,
  agent: 'claude',
  createdAt: base + minutes * 60_000,
  finishedAt: base + minutes * 60_000 + 74_000,
  ...extra
})
const assistant = (text) => ({ kind: 'assistant', id: id(), text })
const tool = (kind, name, title, output, status = 'done') => ({
  kind: 'tool',
  id: id(),
  tool: kind,
  name,
  title,
  ...(output !== undefined && { output }),
  status
})

const chat = (chatId, title, minutes, extra = {}) => ({
  id: chatId,
  title,
  agent: 'claude',
  createdAt: base + minutes * 60_000,
  model: 'sonnet',
  effort: 'medium',
  hasCustomTitle: true,
  ...extra
})

/** Лента чата → содержимое файла переписки (то, что кладёт `demo-profile.mjs`). */
const timeline = (items, extra = {}) => ({ items, ...extra })

// --- Переписки -----------------------------------------------------------------------------

const RICH_ANSWER = `Retries fire twice because \`schedule()\` is called from two places: the sender after a failed attempt, and the queue worker when it picks the job up again.

Here is the shape of the fix:

\`\`\`ts
export async function deliver(event: WebhookEvent, attempt = 1): Promise<void> {
  const response = await post(event.url, event.payload)
  if (response.ok) return
  if (attempt >= MAX_ATTEMPTS) throw new DeliveryError(event.id)
  // Only the worker schedules the next try now.
  await queue.retry(event.id, backoff(attempt))
}
\`\`\`

## What changed

1. \`deliver\` no longer schedules a retry itself — it hands the event back to the queue.
2. \`backoff(attempt)\` grows as **2 s, 4 s, 8 s, 16 s** with up to 20% jitter.
3. Events that fail the last attempt move to the \`dead\` list instead of vanishing.

| Attempt | Delay | Total wait |
| ------- | ----- | ---------- |
| 1       | 2 s   | 2 s        |
| 2       | 4 s   | 6 s        |
| 3       | 8 s   | 14 s       |
| 4       | 16 s  | 30 s       |

> Existing events in the queue keep their old schedule; only new failures use the backoff.

All **18** tests in \`webhooks/\` pass, including the new double-delivery regression test.`

const conversations = {
  /** Ответ с разметкой: код, список, таблица, цитата. */
  'c-harbor-answer': timeline([
    user('Find out why the webhook retries fire twice and fix it.', 0),
    assistant("I'll check where retries are scheduled."),
    tool('search', 'Grep', 'schedule( in src/webhooks', 'src/webhooks/send.ts:31\nsrc/webhooks/worker.ts:18'),
    tool('read', 'Read', 'src/webhooks/send.ts', 'export async function deliver(event: WebhookEvent) {\n  ...\n}'),
    assistant(RICH_ANSWER)
  ]),

  /** Разрешение дано. */
  'c-harbor-allowed': timeline([
    user('Clean up the old build output before we ship.', 10),
    assistant('I need to delete the stale `dist/` folder first.'),
    {
      kind: 'approval',
      id: id(),
      title: 'Allow Claude to run a command?',
      description: 'Remove the stale build output',
      fields: [{ name: 'command', value: 'rm -rf dist && ls' }],
      status: 'allowed'
    },
    tool('command', 'Bash', 'rm -rf dist && ls', 'package.json\nsrc\ntests'),
    assistant('Done — `dist/` is gone. The folder now holds only `package.json`, `src` and `tests`.')
  ]),

  /** Разрешение отклонено. */
  'c-harbor-denied': timeline([
    user('Drop the staging database so we can start fresh.', 20),
    assistant("I'll drop the staging schema."),
    {
      kind: 'approval',
      id: id(),
      title: 'Allow Claude to use sql write (harbor-staging)?',
      description: 'Run a destructive statement against the staging database',
      fields: [
        { name: 'query', value: 'DROP SCHEMA public CASCADE' },
        { name: 'confirm_token', value: 'staging-7f3a' }
      ],
      status: 'denied'
    },
    assistant("Understood, I won't touch the database. Tell me which tables to clear and I'll write a safe script.")
  ]),

  /** Вопрос агента, на который ответили. */
  'c-harbor-answered': timeline([
    user('Add a retry policy to the webhook sender.', 30),
    assistant('Before I write it I need two decisions.'),
    {
      kind: 'question',
      id: id(),
      title: 'Agent question',
      description: 'Claude needs a few answers to continue',
      fields: [
        {
          id: 'strategy',
          label: 'Strategy',
          description: 'Which retry strategy should the webhook sender use?',
          type: 'choice',
          options: [
            { value: 'exponential', label: 'Exponential backoff', description: 'Doubles the delay after every failure' },
            { value: 'fixed', label: 'Fixed interval', description: 'Same delay between all attempts' }
          ],
          required: true
        },
        {
          id: 'attempts',
          label: 'Attempts',
          description: 'How many attempts before an event is parked?',
          type: 'number',
          integer: true,
          required: true
        }
      ],
      status: 'answered',
      answers: { strategy: 'exponential', attempts: 5 }
    },
    assistant('Exponential backoff with **5 attempts** it is. I added `retryPolicy.ts` and wired it into the sender.')
  ]),

  /** Сжатие разговора: автоматическое, ручное и неудачное. */
  'c-harbor-compaction': timeline([
    user('Walk me through how events move from the API to the worker.', 40),
    assistant('Events enter through `POST /events`, are validated, then pushed to the `deliveries` queue. A worker pops them in order and calls `deliver`.'),
    { kind: 'compaction', id: id(), status: 'done', trigger: 'auto', tokensBefore: 168_400, tokensAfter: 9_200 },
    user('Now list the places that write to that queue.', 52),
    assistant('Three places: the API route, the retry scheduler and the dead-letter replay command.'),
    { kind: 'compaction', id: id(), status: 'done', trigger: 'manual', tokensBefore: 41_300, tokensAfter: 6_100 },
    { kind: 'compaction', id: id(), status: 'failed', error: 'The conversation is too short to summarize' }
  ]),

  /** Ошибка агента. */
  'c-harbor-error': timeline([
    user('Run the full integration suite against production.', 60),
    assistant("I'll start the suite now."),
    tool('command', 'Bash', 'npm run test:integration', 'connect ETIMEDOUT 10.4.2.17:5432', 'failed'),
    { kind: 'error', id: id(), message: 'API Error: 529 Overloaded. The model is busy right now — try again in a moment.' }
  ]),

  /** Отчёт /context. */
  'c-harbor-context': timeline([
    user('/context', 70),
    {
      kind: 'context',
      id: id(),
      context: {
        used: 84_300,
        limit: 200_000,
        categories: [
          { name: 'Messages', tokens: 41_800 },
          { name: 'System tools', tokens: 17_900 },
          { name: 'System prompt', tokens: 8_200 },
          { name: 'Skills', tokens: 6_400 },
          { name: 'MCP tools', tokens: 5_900 },
          { name: 'Memory files', tokens: 2_600 },
          { name: 'Custom agents', tokens: 1_500 }
        ]
      }
    }
  ]),

  /** Лимиты /usage. */
  'c-harbor-limits': timeline([
    user('/usage', 80),
    {
      kind: 'limits',
      id: id(),
      limits: [
        { label: 'Current week (all models)', shortLabel: 'Week', percent: 42, resetsAt: Date.UTC(2026, 10, 19, 9) },
        { label: 'Current week (Opus)', shortLabel: 'Opus week', model: 'Opus', percent: 12, resetsAt: Date.UTC(2026, 10, 19, 9) },
        { label: 'Current week (Sonnet)', shortLabel: 'Sonnet week', model: 'Sonnet', percent: 87, resetsAt: Date.UTC(2026, 10, 19, 9) }
      ]
    }
  ]),

  /** Смена агента посреди разговора. */
  'c-harbor-switch': timeline(
    [
      user('Outline how we should split the delivery worker into two services.', 90),
      assistant('Split by responsibility: **ingest** accepts and validates events, **dispatch** owns retries and delivery.'),
      { kind: 'agent-switch', id: id(), agent: 'codex' },
      user('Now write the queue interface both services share.', 100, { agent: 'codex' }),
      assistant('Added `queue.ts` with `enqueue`, `claim` and `release`; both services depend only on that module.')
    ],
    { sessionAgent: 'codex', lastAgent: 'codex' }
  ),

  /** Сообщение с картинкой и файлами. */
  'c-harbor-attachments': timeline([
    user('Why does the delivery chart look flat after 14:00? Config and logs are attached.', 110, {
      images: ['__IMAGE__'],
      files: ['/tmp/atox-demo/harbor/config/retry.yaml', '/tmp/atox-demo/harbor/logs/worker-2026-11-16.log', '/tmp/atox-demo/harbor/docs']
    }),
    assistant('The chart flattens because the worker stopped reporting after 14:02 — the log shows the connection pool closing and never reopening. `retry.yaml` also caps the pool at **2** connections, which explains why a single timeout stalled it.')
  ]),

  /** Сообщения в очереди: агент занят, пока пользователь пишет дальше. */
  'c-harbor-queued': timeline(
    [
      user('Migrate the delivery log table to the new schema.', 120),
      assistant('Starting the migration; I will report once every shard is done.')
    ],
    {
      queue: [
        {
          item: user('Also add an index on `delivered_at`.', 131, { finishedAt: undefined }),
          text: 'Also add an index on `delivered_at`.',
          images: [],
          agent: 'claude'
        },
        {
          item: user('And keep the old table for a week.', 132, { finishedAt: undefined }),
          text: 'And keep the old table for a week.',
          images: [],
          agent: 'claude'
        }
      ]
    }
  ),

  /** Длинный разговор для набранного в поле текста и меню команд. */
  'c-harbor-compose': timeline([
    user('Summarize what the delivery worker does.', 140),
    assistant('It pops events from the `deliveries` queue, posts each payload to the subscriber URL and records the result. Failures go back to the queue with a backoff delay.')
  ])
}

// --- Проекты -------------------------------------------------------------------------------

const harborChats = [
  chat('c-harbor-answer', 'Fix double webhook retries', 0),
  chat('c-harbor-worker-1', 'Review the retry tests', 5, {
    agent: 'codex',
    model: undefined,
    effort: undefined,
    parentChatId: 'c-harbor-answer'
  }),
  chat('c-harbor-worker-2', 'Check the backoff maths', 6, { parentChatId: 'c-harbor-answer' }),
  chat('c-harbor-fork', 'Fix retries, keep dead letters', 7, { parentChatId: 'c-harbor-answer', fork: true }),
  chat('c-harbor-allowed', 'Clean up the old build', 10),
  chat('c-harbor-denied', 'Reset the staging database', 20),
  chat('c-harbor-answered', 'Add a retry policy', 30),
  chat('c-harbor-compaction', 'Event flow walkthrough', 40),
  chat('c-harbor-error', 'Run the integration suite', 60),
  chat('c-harbor-context', 'Context report', 70),
  chat('c-harbor-limits', 'Usage limits', 80),
  chat('c-harbor-switch', 'Split the delivery worker', 90, { agent: 'codex', model: undefined, effort: undefined }),
  chat('c-harbor-attachments', 'Flat delivery chart', 110),
  chat('c-harbor-queued', 'Migrate the delivery log', 120),
  chat('c-harbor-compose', 'Delivery worker overview', 140),
  chat('c-harbor-empty', 'New chat', 150, { hasCustomTitle: undefined }),
  chat('c-harbor-working', 'Trace the double retries', 160),
  chat('c-harbor-approval', 'Remove stale build output', 170),
  chat('c-harbor-question', 'Choose a retry strategy', 180)
]

const archived = (chatId, title, minutes, extra = {}) => ({
  ...chat(chatId, title, minutes, extra),
  archivedAt: base - minutes * 60_000
})

const harborArchive = [
  archived('c-harbor-old-1', 'Spike: websockets for delivery status', 600),
  archived('c-harbor-old-2', 'Rename the events table', 2_400, { agent: 'codex', model: undefined, effort: undefined }),
  archived('c-harbor-old-3', 'Draft the status page copy', 9_000)
]

// --- Файлы проекта и картинка --------------------------------------------------------------

const SOURCES = {
  'package.json': '{\n  "name": "harbor",\n  "private": true,\n  "scripts": { "test": "vitest run" }\n}\n',
  'src/webhooks/send.ts':
    "import { schedule } from './schedule'\n\nexport async function deliver(event: WebhookEvent, attempt = 1): Promise<void> {\n  const response = await post(event.url, event.payload)\n  if (response.ok) return\n  if (attempt >= MAX_ATTEMPTS) throw new DeliveryError(event.id)\n  schedule(event, attempt + 1)\n}\n",
  'src/webhooks/schedule.ts':
    "export function schedule(event: WebhookEvent, attempt: number): void {\n  setTimeout(() => queue.push({ event, attempt }), delay(attempt))\n}\n\nexport const delay = (attempt: number) => 2000 * 2 ** (attempt - 1)\n",
  'src/webhooks/worker.ts':
    "export async function work(): Promise<void> {\n  for await (const job of queue) {\n    await deliver(job.event, job.attempt)\n    schedule(job.event, job.attempt + 1)\n  }\n}\n",
  'dist/bundle.js': '// stale build output\n'
}

/** Маленькая PNG-картинка: градиент (график доставки). */
function chartPng(width = 320, height = 180) {
  const crcTable = Array.from({ length: 256 }, (_, n) => {
    let c = n
    for (let k = 0; k < 8; k++) c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1
    return c >>> 0
  })
  const crc = (buffer) => {
    let c = 0xffffffff
    for (const byte of buffer) c = crcTable[(c ^ byte) & 0xff] ^ (c >>> 8)
    return (c ^ 0xffffffff) >>> 0
  }
  const chunk = (type, data) => {
    const body = Buffer.concat([Buffer.from(type), data])
    const length = Buffer.alloc(4)
    length.writeUInt32BE(data.length)
    const checksum = Buffer.alloc(4)
    checksum.writeUInt32BE(crc(body))
    return Buffer.concat([length, body, checksum])
  }
  const rows = []
  for (let y = 0; y < height; y++) {
    const row = Buffer.alloc(1 + width * 3)
    for (let x = 0; x < width; x++) {
      // Линия доставки: растёт до 14:00 и дальше идёт ровно.
      const line = x < width * 0.6 ? height - 20 - x * 0.45 : height - 20 - width * 0.6 * 0.45
      const onLine = Math.abs(y - line) < 3
      const offset = 1 + x * 3
      const shade = 244 - Math.round((y / height) * 18)
      row[offset] = onLine ? 47 : shade
      row[offset + 1] = onLine ? 125 : shade
      row[offset + 2] = onLine ? 255 : shade
    }
    rows.push(row)
  }
  const header = Buffer.alloc(13)
  header.writeUInt32BE(width, 0)
  header.writeUInt32BE(height, 4)
  header[8] = 8
  header[9] = 2
  return Buffer.concat([
    Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]),
    chunk('IHDR', header),
    chunk('IDAT', deflateSync(Buffer.concat(rows))),
    chunk('IEND', Buffer.alloc(0))
  ])
}

// --- Поддельный Anthropic API --------------------------------------------------------------

const MODEL = 'claude-sonnet-4-5'

/** Текст сообщений пользователя из запроса: блоки `text`, склеенные в одну строку. */
function userText(messages) {
  const first = messages.find(({ role }) => role === 'user')
  const content = first?.content
  if (typeof content === 'string') {
    return content
  }
  return (content ?? []).map((block) => block.text ?? '').join('\n')
}

const text = (value) => ({ type: 'text', text: value })
const toolUse = (name, input, index) => ({ type: 'tool_use', id: `toolu_demo_${name}_${index}`, name, input })

/**
 * Сценарии: по тексту первого сообщения и числу ответов агента в запросе (`step`) — что
 * ответить. `hang` — начать ответ и не заканчивать его: агент остаётся «работающим».
 */
function scenario(prompt, step) {
  if (/double retr|retries fire/i.test(prompt)) {
    return [
      { blocks: [text("I'll start by looking at where retries are scheduled."), toolUse('Bash', { command: 'ls src/webhooks', description: 'List the webhook sources' }, 0)] },
      { blocks: [toolUse('Read', { file_path: 'src/webhooks/send.ts' }, 1)] },
      { blocks: [toolUse('Read', { file_path: 'src/webhooks/worker.ts' }, 2)] },
      { blocks: [toolUse('Read', { file_path: 'src/webhooks/schedule.ts' }, 3)] },
      { hang: 'Found it: `deliver` and the worker both call `schedule`, so every failure is queued twice. ' }
    ][step]
  }
  if (/stale build/i.test(prompt)) {
    return [
      {
        blocks: [
          text('The old `dist/` folder has to go before the next build.'),
          toolUse('Bash', { command: 'rm -rf dist && ls', description: 'Remove the stale build output' }, 0)
        ]
      },
      { blocks: [text('Done — `dist/` is gone.')], stop: 'end_turn' }
    ][step]
  }
  if (/retry strategy/i.test(prompt)) {
    return [
      {
        blocks: [
          text('Before I change anything I need a decision from you.'),
          toolUse(
            'AskUserQuestion',
            {
              questions: [
                {
                  question: 'Which retry strategy should the webhook sender use?',
                  header: 'Strategy',
                  multiSelect: false,
                  options: [
                    { label: 'Exponential backoff', description: 'Doubles the delay after every failed attempt' },
                    { label: 'Fixed interval', description: 'Same delay between all attempts' },
                    { label: 'Fibonacci backoff', description: 'Delays grow slower than exponential' }
                  ]
                }
              ]
            },
            0
          )
        ]
      },
      { blocks: [text('Got it — using that strategy.')], stop: 'end_turn' }
    ][step]
  }
  return undefined
}

const sse = (response, event, data) => response.write(`event: ${event}\ndata: ${JSON.stringify(data)}\n\n`)

/** Один ответ потоком: `message_start`, блоки, `message_delta`, `message_stop`. */
function streamMessage(response, script) {
  response.writeHead(200, { 'content-type': 'text/event-stream', 'cache-control': 'no-cache' })
  sse(response, 'message_start', {
    type: 'message_start',
    message: {
      id: `msg_demo_${Date.now()}`,
      type: 'message',
      role: 'assistant',
      model: MODEL,
      content: [],
      stop_reason: null,
      stop_sequence: null,
      usage: { input_tokens: 1200, output_tokens: 1 }
    }
  })
  const blocks = script.blocks ?? [text(script.hang ?? '')]
  blocks.forEach((block, index) => {
    if (block.type === 'text') {
      sse(response, 'content_block_start', { type: 'content_block_start', index, content_block: { type: 'text', text: '' } })
      sse(response, 'content_block_delta', { type: 'content_block_delta', index, delta: { type: 'text_delta', text: block.text } })
      if (!script.hang) {
        sse(response, 'content_block_stop', { type: 'content_block_stop', index })
      }
    } else {
      sse(response, 'content_block_start', {
        type: 'content_block_start',
        index,
        content_block: { type: 'tool_use', id: block.id, name: block.name, input: {} }
      })
      sse(response, 'content_block_delta', {
        type: 'content_block_delta',
        index,
        delta: { type: 'input_json_delta', partial_json: JSON.stringify(block.input) }
      })
      sse(response, 'content_block_stop', { type: 'content_block_stop', index })
    }
  })
  if (script.hang) {
    // Ответ не заканчивается: агент так и остаётся «пишущим».
    return
  }
  sse(response, 'message_delta', {
    type: 'message_delta',
    delta: { stop_reason: script.stop ?? 'tool_use', stop_sequence: null },
    usage: { output_tokens: 180 }
  })
  sse(response, 'message_stop', { type: 'message_stop' })
  response.end()
}

/** Запускает поддельный API на свободном порту; сервер не мешает процессу завершиться. */
async function startFakeApi() {
  const server = createServer((request, response) => {
    const chunks = []
    request.on('data', (chunk) => chunks.push(chunk))
    request.on('end', () => {
      let body = {}
      try {
        body = JSON.parse(Buffer.concat(chunks).toString('utf8') || '{}')
      } catch {
        // не JSON — отвечаем как на пустой запрос
      }
      const messages = body.messages ?? []
      const step = messages.filter(({ role }) => role === 'assistant').length
      const script = request.url?.includes('/messages') ? scenario(userText(messages), step) : undefined
      const reply = script ?? { blocks: [text('Okay.')], stop: 'end_turn' }
      if (!request.url?.includes('/messages')) {
        response.writeHead(200, { 'content-type': 'application/json' })
        response.end('{}')
      } else if (body.stream) {
        streamMessage(response, reply)
      } else {
        response.writeHead(200, { 'content-type': 'application/json' })
        response.end(
          JSON.stringify({
            id: 'msg_demo',
            type: 'message',
            role: 'assistant',
            model: MODEL,
            content: reply.blocks ?? [text('Okay.')],
            stop_reason: reply.stop ?? 'end_turn',
            stop_sequence: null,
            usage: { input_tokens: 10, output_tokens: 5 }
          })
        )
      }
    })
  })
  server.on('connection', (socket) => socket.unref())
  server.unref()
  await new Promise((resolve) => server.listen(0, '127.0.0.1', resolve))
  return server.address().port
}

/**
 * `demo-profile.mjs` пишет в файл переписки только ленту. Очередь и агент сессии дописываются
 * сюда, когда этот файл появится: приложение читает его позже, при открытии чата.
 */
function rewriteLater(file, data) {
  const deadline = Date.now() + 60_000
  const attempt = async () => {
    try {
      await access(file)
    } catch {
      if (Date.now() < deadline) {
        setTimeout(attempt, 25).unref()
      }
      return
    }
    // Файл уже есть, но пишется демо-профилем: даём ему закончить.
    await new Promise((resolve) => setTimeout(resolve, 150))
    await writeFile(
      file,
      JSON.stringify({ version: 1, queue: [], sessionAgent: 'claude', lastAgent: 'claude', ...data })
    )
  }
  setTimeout(attempt, 0).unref()
}

// --- Подключение к профилю -----------------------------------------------------------------

export async function extend(context) {
  if (!wanted()) {
    return {}
  }
  const path = join(context.repositories, 'harbor')
  await rm(path, { recursive: true, force: true })
  for (const [file, content] of Object.entries(SOURCES)) {
    await mkdir(join(path, file, '..'), { recursive: true })
    await writeFile(join(path, file), content)
  }
  await mkdir(join(path, 'config'), { recursive: true })
  await mkdir(join(path, 'logs'), { recursive: true })
  await mkdir(join(path, 'docs'), { recursive: true })
  await writeFile(join(path, 'config', 'retry.yaml'), 'pool: 2\nattempts: 5\n')
  await writeFile(join(path, 'logs', 'worker-2026-11-16.log'), '14:02 pool closed\n')

  const imagePath = join(context.repositories, 'assets', 'delivery-chart.png')
  await mkdir(join(imagePath, '..'), { recursive: true })
  await writeFile(imagePath, chartPng())

  // Агент проекта ходит за ответами на поддельный API, а не в сеть.
  const port = await startFakeApi()
  await mkdir(join(path, '.claude'), { recursive: true })
  await writeFile(
    join(path, '.claude', 'settings.json'),
    JSON.stringify({
      // Atox запускает Claude без вопросов; правило «ask» заставляет спросить про удаление.
      permissions: { ask: ['Bash(rm:*)'] },
      env: {
        ANTHROPIC_BASE_URL: `http://127.0.0.1:${port}`,
        ANTHROPIC_API_KEY: 'sk-ant-demo-key',
        DISABLE_TELEMETRY: '1',
        DISABLE_AUTOUPDATER: '1',
        CLAUDE_CODE_DISABLE_NONESSENTIAL_TRAFFIC: '1'
      }
    })
  )
  // Домашняя папка без чужих настроек, хуков и CLAUDE.md пользователя.
  const home = join(context.repositories, 'chat-home')
  await mkdir(home, { recursive: true })
  await writeFile(join(home, '.claude.json'), JSON.stringify({ hasCompletedOnboarding: true }))

  context.projects.push({
    id: 'p-harbor',
    name: 'Harbor',
    spaceId: 'space-main',
    icon: 'anchor',
    color: 'purple',
    path,
    chats: harborChats.map((entry) => ({ ...entry })),
    archivedChats: harborArchive
  })

  for (const [chatId, data] of Object.entries(conversations)) {
    context.conversations[chatId] = data.items.map((item) =>
      item.kind === 'user' && item.images?.[0] === '__IMAGE__' ? { ...item, images: [imagePath] } : item
    )
    const { items: _items, ...extras } = data
    if (Object.keys(extras).length > 0) {
      rewriteLater(join(context.userData, 'conversations', `${chatId}.json`), data)
    }
  }
  return { env: { HOME: home } }
}
