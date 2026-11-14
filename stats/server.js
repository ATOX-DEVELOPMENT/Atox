import { createServer } from 'node:http'
import geoip from 'geoip-country'
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
/**
 * Файлы, которые люди скачивают сами. Не считаем то, что качает само приложение при обновлении
 * (zip на macOS, AppImage на Linux), и служебные файлы (манифесты, blockmap): иначе каждое
 * обновление выглядело бы как новое скачивание.
 */
const INSTALLER = /\.(dmg|pacman)$/i

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

/** Периоды панели: сколько дней показывать; `all` — всё время. */
const RANGES = { 7: 7, 30: 30, 90: 90, all: null }
const DEFAULT_RANGE = '30'
/** Дольше года график не растягиваем: линия превратилась бы в штрих. */
const MAX_CHART_DAYS = 365
const TOP_ROWS = 20

const VERSION_FORMAT = /^[\w.+-]{1,40}$/
const OS_FORMAT = /^[\w .+-]{1,40}$/
const SESSION_FORMAT = /^[\w-]{1,64}$/

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
  ALTER TABLE usage_events ADD COLUMN IF NOT EXISTS country text;
  -- Запуск приложения: по нему считаются сессии, как в Aptabase.
  ALTER TABLE usage_events ADD COLUMN IF NOT EXISTS session_id text;
  -- Откуда событие: \`null\` — от приложения, \`aptabase\` — перенесено из выгрузки Aptabase.
  ALTER TABLE usage_events ADD COLUMN IF NOT EXISTS source text;
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

const matching = (value, format) => (typeof value === 'string' && format.test(value) ? value : null)

async function recordEvent(request, response) {
  const address = clientAddress(request)
  if (rateLimited(address)) return reply(response, 429, 'Too many requests')
  let body
  try {
    body = await readJson(request)
  } catch {
    return reply(response, 400, 'Bad request')
  }
  if (!body || !Object.hasOwn(EVENTS, body.name)) return reply(response, 400, 'Unknown event')
  // Адрес нужен только чтобы узнать страну; сам он нигде не сохраняется.
  const country = geoip.lookup(address)?.country ?? null
  await db.query(
    'INSERT INTO usage_events (name, version, os, country, session_id) VALUES ($1, $2, $3, $4, $5)',
    [
      body.name,
      matching(body.version, VERSION_FORMAT),
      matching(body.os, OS_FORMAT),
      country,
      matching(body.sessionId, SESSION_FORMAT)
    ]
  )
  reply(response, 204)
}

let downloads = { at: 0, value: null }

/** Сумма скачиваний установочных файлов по всем релизам; при сбое GitHub — прошлое значение. */
async function countDownloads() {
  if (downloads.value !== null && Date.now() - downloads.at < DOWNLOADS_CACHE_MS) return downloads.value
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

/** Начало периода: полночь UTC первого дня; `null` — с самого начала. */
function periodStart(days) {
  if (days === null) return null
  const start = new Date()
  start.setUTCHours(0, 0, 0, 0)
  start.setUTCDate(start.getUTCDate() - (days - 1))
  return start
}

/** Сессия события; у события без сессии — своя, чтобы оно всё равно посчиталось. */
const SESSION = 'coalesce(session_id, id::text)'

/** Топ значений колонки по числу сессий за период — так считает Aptabase. */
async function breakdown(column, since) {
  const { rows } = await db.query(
    `SELECT ${column} AS label, count(DISTINCT ${SESSION})::int AS count FROM usage_events
      WHERE ($1::timestamptz IS NULL OR created_at >= $1)
      GROUP BY 1 ORDER BY count DESC, label LIMIT ${TOP_ROWS}`,
    [since]
  )
  return rows
}

async function collectStats(rangeKey) {
  const since = periodStart(RANGES[rangeKey])
  const [installs, daily, weekly, monthly, totals, perDay, events, versions, systems, countries] =
    await Promise.all([
      countEvents('install'),
      countEvents('daily_active', EVENTS.daily_active),
      countEvents('weekly_active', EVENTS.weekly_active),
      countEvents('monthly_active', EVENTS.monthly_active),
      db.query(
        `SELECT count(*)::int AS events, count(DISTINCT ${SESSION})::int AS sessions FROM usage_events
          WHERE ($1::timestamptz IS NULL OR created_at >= $1)`,
        [since]
      ),
      db.query(
        `SELECT to_char(created_at AT TIME ZONE 'UTC', 'YYYY-MM-DD') AS day, name, count(*)::int AS count
           FROM usage_events
          WHERE name IN ('daily_active', 'install') AND ($1::timestamptz IS NULL OR created_at >= $1)
          GROUP BY 1, 2`,
        [since]
      ),
      db.query(
        `SELECT name AS label, count(*)::int AS count FROM usage_events
          WHERE ($1::timestamptz IS NULL OR created_at >= $1)
          GROUP BY name ORDER BY count DESC`,
        [since]
      ),
      breakdown('version', since),
      breakdown('os', since),
      breakdown('country', since)
    ])
  return {
    range: rangeKey,
    downloads: await countDownloads(),
    installs,
    daily,
    weekly,
    monthly,
    sessions: totals.rows[0].sessions,
    eventCount: totals.rows[0].events,
    days: buildDays(perDay.rows, since),
    events: events.rows,
    versions,
    systems,
    countries
  }
}

/** По строке на каждый день периода — и пустые дни, чтобы график не рвался. */
function buildDays(rows, since) {
  const byDay = new Map()
  for (const { day, name, count } of rows) {
    byDay.set(day, { ...byDay.get(day), [name]: count })
  }
  const today = new Date()
  today.setUTCHours(0, 0, 0, 0)
  let start = since
  if (!start) {
    const first = [...byDay.keys()].sort()[0]
    start = first ? new Date(`${first}T00:00:00Z`) : today
  }
  const earliest = new Date(today)
  earliest.setUTCDate(earliest.getUTCDate() - (MAX_CHART_DAYS - 1))
  if (start < earliest) start = earliest

  const days = []
  for (const day = new Date(start); day <= today; day.setUTCDate(day.getUTCDate() + 1)) {
    const key = day.toISOString().slice(0, 10)
    const counts = byDay.get(key) ?? {}
    days.push({ day: key, users: counts.daily_active ?? 0, installs: counts.install ?? 0 })
  }
  return days
}

const number = new Intl.NumberFormat('en-US')
const regionNames = new Intl.DisplayNames(['en'], { type: 'region' })

const escapeHtml = (value) =>
  String(value).replace(/[&<>"']/g, (char) => `&#${char.charCodeAt(0)};`)

function countryName(code) {
  if (!code) return 'Unknown'
  try {
    return regionNames.of(code) ?? code
  } catch {
    return code
  }
}

const shortDate = (day) =>
  new Date(`${day}T00:00:00Z`).toLocaleDateString('en-US', {
    month: 'short',
    day: 'numeric',
    timeZone: 'UTC'
  })

/** Линия и заливка под ней для одного ряда значений. */
function drawSeries(values, color, geometry, top) {
  const { left, width, bottom, height } = geometry
  const step = values.length > 1 ? width / (values.length - 1) : 0
  const points = values.map((value, index) => [
    left + index * step,
    bottom - (value / top) * height
  ])
  const line = points.map(([x, y]) => `${x.toFixed(1)},${y.toFixed(1)}`).join(' ')
  const area = `${left},${bottom} ${line} ${left + (values.length - 1) * step},${bottom}`
  return `<polygon points="${area}" fill="${color}" opacity="0.12"/>
    <polyline points="${line}" fill="none" stroke="${color}" stroke-width="2" stroke-linejoin="round" stroke-linecap="round"/>`
}

function chart(days) {
  const geometry = { left: 36, width: 640, bottom: 190, height: 170 }
  const peak = Math.max(1, ...days.map((day) => Math.max(day.users, day.installs)))
  // Шкала по целым людям: полтора человека не бывает.
  const top = Math.max(peak, 3)
  const ticks = [0, 1, 2, 3].map((index) => Math.round((top * index) / 3))
  const grid = [...new Set(ticks)]
    .map((tick) => {
      const y = geometry.bottom - (tick / top) * geometry.height
      return `<line x1="${geometry.left}" x2="${geometry.left + geometry.width}" y1="${y}" y2="${y}" stroke="#2f2f33"/>
      <text x="${geometry.left - 8}" y="${y + 4}" text-anchor="end">${tick}</text>`
    })
    .join('')
  const first = days[0]?.day
  const last = days.at(-1)?.day
  return `<svg viewBox="0 0 700 214" role="img" aria-label="Daily users and installs">
    ${grid}
    ${drawSeries(days.map((day) => day.installs), '#ff9f0a', geometry, top)}
    ${drawSeries(days.map((day) => day.users), '#4a8cff', geometry, top)}
    <text x="${geometry.left}" y="210">${first ? shortDate(first) : ''}</text>
    <text x="${geometry.left + geometry.width}" y="210" text-anchor="end">${last ? shortDate(last) : ''}</text>
  </svg>`
}

function bars(title, rows, format = escapeHtml) {
  const total = rows.reduce((sum, row) => sum + row.count, 0)
  const items = rows.length
    ? rows
        .map((row) => {
          const share = total ? Math.round((row.count / total) * 100) : 0
          return `<li style="--share:${share}%"><span>${format(row.label ?? 'Unknown')}</span><b>${number.format(row.count)}</b><i>${share}%</i></li>`
        })
        .join('')
    : '<li class="empty">No data yet</li>'
  return `<section class="card"><h2>${title}</h2><ul class="bars">${items}</ul></section>`
}

function dashboard(stats) {
  const tile = (label, value, hint) => `
    <div class="tile"><div class="value">${value === null ? '—' : number.format(value)}</div>
    <div class="label">${label}</div><div class="hint">${hint}</div></div>`
  const ranges = Object.keys(RANGES)
    .map(
      (key) =>
        `<a href="/?range=${key}"${key === stats.range ? ' aria-current="page"' : ''}>${key === 'all' ? 'All time' : `${key} days`}</a>`
    )
    .join('')
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
  body { margin: 0; background: #1b1b1d; color: #ececee;
    font: 15px/1.4 -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; }
  main { width: min(960px, 100% - 32px); margin: 0 auto; padding: 32px 0 48px; }
  header { display: flex; align-items: center; justify-content: space-between; gap: 16px; margin-bottom: 20px; flex-wrap: wrap; }
  h1 { margin: 0; font-size: 18px; font-weight: 600; letter-spacing: .02em; }
  nav { display: flex; gap: 4px; padding: 3px; border-radius: 10px; background: #242427; border: 1px solid #2f2f33; }
  nav a { padding: 5px 12px; border-radius: 7px; color: #8d8d94; text-decoration: none; font-size: 13px; }
  nav a[aria-current] { background: #36363b; color: #ececee; }
  .grid { display: grid; grid-template-columns: repeat(auto-fit, minmax(150px, 1fr)); gap: 12px; margin-bottom: 12px; }
  .tile, .card { border-radius: 14px; background: #242427; border: 1px solid #2f2f33; }
  .tile { padding: 18px; }
  .value { font-size: 32px; font-weight: 650; font-variant-numeric: tabular-nums; }
  .label { margin-top: 2px; font-weight: 550; }
  .hint { margin-top: 2px; font-size: 12px; color: #8d8d94; }
  .card { padding: 18px 20px; margin-bottom: 12px; }
  .card h2 { margin: 0 0 12px; font-size: 14px; font-weight: 600; }
  .legend { display: flex; gap: 16px; margin-bottom: 8px; font-size: 12px; color: #8d8d94; }
  .legend span::before { content: ''; display: inline-block; width: 8px; height: 8px; margin-right: 6px; border-radius: 50%; background: var(--dot); }
  svg { display: block; width: 100%; height: auto; }
  svg text { fill: #8d8d94; font-size: 11px; }
  .pair { display: grid; grid-template-columns: repeat(auto-fit, minmax(300px, 1fr)); gap: 12px; }
  .pair .card { margin-bottom: 0; }
  .bars { list-style: none; margin: 0; padding: 0; display: grid; gap: 6px; }
  .bars li { position: relative; display: grid; grid-template-columns: 1fr auto 44px; gap: 8px; padding: 6px 10px; border-radius: 8px; overflow: hidden; font-size: 14px; }
  .bars li::before { content: ''; position: absolute; inset: 0 auto 0 0; width: var(--share); background: #2a3d66; z-index: 0; }
  .bars li > * { position: relative; z-index: 1; }
  .bars b { font-weight: 550; font-variant-numeric: tabular-nums; }
  .bars i { font-style: normal; text-align: right; color: #8d8d94; font-variant-numeric: tabular-nums; }
  .bars .empty { display: block; color: #8d8d94; }
  .bars .empty::before { display: none; }
  .note { margin: 16px 2px 0; font-size: 12px; color: #8d8d94; }
</style>
</head>
<body>
<main>
  <header><h1>Atox</h1><nav aria-label="Period">${ranges}</nav></header>
  <div class="grid">
    ${tile('Downloads', stats.downloads, '.dmg and Arch packages')}
    ${tile('Installs', stats.installs, 'first launches, all time')}
    ${tile('Today', stats.daily, 'users in the last day')}
    ${tile('This week', stats.weekly, 'users in 7 days')}
    ${tile('This month', stats.monthly, 'users in 30 days')}
    ${tile('Sessions', stats.sessions, 'app launches in the period')}
    ${tile('Events', stats.eventCount, 'in the period')}
  </div>
  <section class="card">
    <h2>Daily users</h2>
    <div class="legend"><span style="--dot:#4a8cff">Daily users</span><span style="--dot:#ff9f0a">Installs</span></div>
    ${chart(stats.days)}
  </section>
  <div class="pair">
    ${bars('Countries', stats.countries, (code) => escapeHtml(code === 'Unknown' ? code : countryName(code)))}
    ${bars('Operating systems', stats.systems)}
    ${bars('App versions', stats.versions)}
    ${bars('Events', stats.events)}
  </div>
  <p class="note">Countries, systems and versions count sessions (app launches), like Aptabase. Days are in UTC.</p>
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
    const { pathname, searchParams } = new URL(request.url ?? '/', 'http://localhost')
    if (request.method === 'POST' && pathname === '/v1/event') return await recordEvent(request, response)
    if (request.method !== 'GET' && request.method !== 'HEAD') return reply(response, 405, 'Method not allowed')
    if (pathname === '/health') return reply(response, 200, 'ok')
    const requested = searchParams.get('range')
    const range = Object.hasOwn(RANGES, requested) ? requested : DEFAULT_RANGE
    if (pathname === '/api/stats') {
      return reply(response, 200, JSON.stringify(await collectStats(range)), 'application/json')
    }
    if (pathname === '/') {
      return reply(response, 200, dashboard(await collectStats(range)), 'text/html; charset=utf-8')
    }
    reply(response, 404, 'Not found')
  } catch (error) {
    console.error(error)
    if (!response.headersSent) reply(response, 500, 'Internal error')
  }
}).listen(PORT, () => console.log(`Atox stats on :${PORT}`))
