import { createServer } from 'node:http'
import pg from 'pg'

const PORT = Number(process.env.PORT) || 3000
const DATABASE_URL = process.env.DATABASE_URL
/** Репозиторий, из релизов которого скачивается Atox. */
const GITHUB_REPO = process.env.GITHUB_REPO || 'malikfattaev/Atox'
/** Токен GitHub не обязателен: с ним у API выше лимит запросов. */
const GITHUB_TOKEN = process.env.GITHUB_TOKEN

/** Сколько держать подсчёт скачиваний, прежде чем спросить GitHub снова. */
const DOWNLOADS_CACHE_MS = 10 * 60 * 1000
const GITHUB_TIMEOUT_MS = 8000
/** Файлы релиза, которые скачивают люди; манифесты и blockmap — служебные, их не считаем. */
const INSTALLER = /\.(dmg|zip|AppImage|pacman|exe)$/i

const MAX_BODY_BYTES = 4 * 1024
/** Сколько событий с одного адреса в минуту; клиент шлёт не больше четырёх в сутки. */
const RATE_LIMIT_PER_MINUTE = 30

/** События, которые шлёт приложение, и за какой срок (в днях) каждое считается «активным». */
const EVENTS = {
  install: null,
  daily_active: 1,
  weekly_active: 7,
  monthly_active: 30
}

if (!DATABASE_URL) {
  console.error('DATABASE_URL is not set')
  process.exit(1)
}

const db = new pg.Pool({
  connectionString: DATABASE_URL,
  ssl: /\.railway\.internal|localhost|127\.0\.0\.1/.test(DATABASE_URL)
    ? false
    : { rejectUnauthorized: false }
})

await db.query(`
  CREATE TABLE IF NOT EXISTS usage_events (
    id bigserial PRIMARY KEY,
    name text NOT NULL,
    version text,
    os text,
    created_at timestamptz NOT NULL DEFAULT now()
  );
  CREATE INDEX IF NOT EXISTS usage_events_name_created_idx ON usage_events (name, created_at);
`)

const rateWindows = new Map()

function rateLimited(address) {
  const minute = Math.floor(Date.now() / 60000)
  const entry = rateWindows.get(address)
  if (!entry || entry.minute !== minute) {
    rateWindows.set(address, { minute, count: 1 })
    return false
  }
  entry.count += 1
  return entry.count > RATE_LIMIT_PER_MINUTE
}

setInterval(() => {
  const minute = Math.floor(Date.now() / 60000)
  for (const [address, entry] of rateWindows) if (entry.minute !== minute) rateWindows.delete(address)
}, 60000).unref()

function clientAddress(request) {
  const forwarded = request.headers['x-forwarded-for']
  return (typeof forwarded === 'string' ? forwarded.split(',')[0].trim() : '') || request.socket.remoteAddress || ''
}

async function readJson(request) {
  const chunks = []
  let size = 0
  for await (const chunk of request) {
    size += chunk.length
    if (size > MAX_BODY_BYTES) throw new Error('too large')
    chunks.push(chunk)
  }
  return JSON.parse(Buffer.concat(chunks).toString('utf8'))
}

const short = (value) => (typeof value === 'string' ? value.slice(0, 40) : null)

async function recordEvent(request, response) {
  if (rateLimited(clientAddress(request))) return reply(response, 429, 'Too many requests')
  let body
  try {
    body = await readJson(request)
  } catch {
    return reply(response, 400, 'Bad request')
  }
  if (!body || !Object.hasOwn(EVENTS, body.name)) return reply(response, 400, 'Unknown event')
  await db.query('INSERT INTO usage_events (name, version, os) VALUES ($1, $2, $3)', [
    body.name,
    short(body.version),
    short(body.os)
  ])
  reply(response, 204)
}

let downloads = { at: 0, value: null }

/** Сумма скачиваний установочных файлов по всем релизам; при сбое GitHub — прошлое значение. */
async function countDownloads() {
  if (downloads.value && Date.now() - downloads.at < DOWNLOADS_CACHE_MS) return downloads.value
  try {
    let total = 0
    for (let page = 1; page <= 10; page += 1) {
      const result = await fetch(
        `https://api.github.com/repos/${GITHUB_REPO}/releases?per_page=100&page=${page}`,
        {
          headers: {
            Accept: 'application/vnd.github+json',
            'User-Agent': 'atox-stats',
            ...(GITHUB_TOKEN ? { Authorization: `Bearer ${GITHUB_TOKEN}` } : {})
          },
          signal: AbortSignal.timeout(GITHUB_TIMEOUT_MS)
        }
      )
      if (!result.ok) throw new Error(`GitHub answered ${result.status}`)
      const releases = await result.json()
      for (const release of releases) {
        for (const asset of release.assets) if (INSTALLER.test(asset.name)) total += asset.download_count
      }
      if (releases.length < 100) break
    }
    downloads = { at: Date.now(), value: total }
  } catch (error) {
    console.warn('Failed to count downloads', error)
  }
  return downloads.value
}

/** Сколько раз пришло событие; с `days` — только за последние `days` суток. */
async function countEvents(name, days = null) {
  const { rows } = await db.query(
    `SELECT count(*)::int AS count FROM usage_events
      WHERE name = $1 AND ($2::int IS NULL OR created_at > now() - make_interval(days => $2))`,
    [name, days]
  )
  return rows[0].count
}

async function collectStats() {
  const [installs, daily, weekly, monthly] = await Promise.all([
    countEvents('install'),
    countEvents('daily_active', EVENTS.daily_active),
    countEvents('weekly_active', EVENTS.weekly_active),
    countEvents('monthly_active', EVENTS.monthly_active)
  ])
  return { downloads: await countDownloads(), installs, daily, weekly, monthly }
}

const number = new Intl.NumberFormat('en-US')

function dashboard(stats) {
  const tile = (label, value, hint) => `
    <div class="tile"><div class="value">${value === null ? '—' : number.format(value)}</div>
    <div class="label">${label}</div><div class="hint">${hint}</div></div>`
  return `<!doctype html>
<html lang="en">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<meta name="robots" content="noindex">
<title>Atox stats</title>
<style>
  :root { color-scheme: dark; }
  * { box-sizing: border-box; }
  body { margin: 0; min-height: 100vh; display: grid; place-items: center; background: #1b1b1d; color: #ececee;
    font: 15px/1.4 -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; }
  main { width: min(720px, 100% - 32px); padding: 32px 0; }
  h1 { margin: 0 0 24px; font-size: 18px; font-weight: 600; letter-spacing: .02em; }
  .grid { display: grid; grid-template-columns: repeat(auto-fit, minmax(200px, 1fr)); gap: 12px; }
  .tile { padding: 20px; border-radius: 14px; background: #242427; border: 1px solid #2f2f33; }
  .value { font-size: 36px; font-weight: 650; font-variant-numeric: tabular-nums; }
  .label { margin-top: 4px; font-weight: 550; }
  .hint { margin-top: 2px; font-size: 13px; color: #8d8d94; }
</style>
</head>
<body>
<main>
  <h1>Atox</h1>
  <div class="grid">
    ${tile('Downloads', stats.downloads, 'all releases, from GitHub')}
    ${tile('Installs', stats.installs, 'first launches')}
    ${tile('Today', stats.daily, 'active in the last day')}
    ${tile('This week', stats.weekly, 'active in the last 7 days')}
    ${tile('This month', stats.monthly, 'active in the last 30 days')}
  </div>
</main>
</body>
</html>`
}

function reply(response, status, body = '', type = 'text/plain; charset=utf-8') {
  response.writeHead(status, { 'Content-Type': type, 'Cache-Control': 'no-store' })
  response.end(body)
}

createServer(async (request, response) => {
  try {
    const { pathname } = new URL(request.url ?? '/', 'http://localhost')
    if (request.method === 'POST' && pathname === '/v1/event') return await recordEvent(request, response)
    if (request.method !== 'GET' && request.method !== 'HEAD') return reply(response, 405, 'Method not allowed')
    if (pathname === '/health') return reply(response, 200, 'ok')
    if (pathname === '/api/stats') {
      return reply(response, 200, JSON.stringify(await collectStats()), 'application/json')
    }
    if (pathname === '/') {
      return reply(response, 200, dashboard(await collectStats()), 'text/html; charset=utf-8')
    }
    reply(response, 404, 'Not found')
  } catch (error) {
    console.error(error)
    if (!response.headersSent) reply(response, 500, 'Internal error')
  }
}).listen(PORT, () => console.log(`Atox stats on :${PORT}`))
