import { createHash, timingSafeEqual } from 'node:crypto'
import { readFile } from 'node:fs/promises'
import { createServer } from 'node:http'
import { gunzip } from 'node:zlib'
import { promisify } from 'node:util'
import pg from 'pg'

const gunzipAsync = promisify(gunzip)

const PORT = Number(process.env.PORT) || 3000
const DATABASE_URL = process.env.DATABASE_URL
/** Куда ведёт корень сайта: у самой службы своей главной страницы нет. */
const HOME_URL = process.env.HOME_URL || 'https://atox.dev'

/** Запрос публикации: сжатый и распакованный размер, экранов и страниц в холсте, размер страницы экрана. */
const MAX_BODY_BYTES = 40 * 1024 * 1024
const MAX_UNPACKED_BYTES = 120 * 1024 * 1024
const MAX_SCREENS = 300
const MAX_PAGES = 30
const MAX_DOC_BYTES = 6 * 1024 * 1024
const MAX_STYLES = 50
const MAX_STYLE_BYTES = 4 * 1024 * 1024
const MAX_THUMB_BYTES = 1024 * 1024
const MAX_SHARES = 20000
/** Файл экрана (картинка, шрифт, стили) отдельно от страницы: по хешу, один раз на все ссылки. */
const MAX_ASSET_BYTES = 12 * 1024 * 1024
const MAX_ASSETS_PER_SHARE = 2000
/** Типы файлов, которые можно положить отдельно; всё остальное остаётся внутри страницы. */
const ASSET_TYPES = /^(image\/(png|jpeg|gif|webp|avif|svg\+xml)|font\/[\w.+-]+|application\/(x-)?font-[\w.+-]+|application\/vnd\.ms-fontobject|text\/css)$/
/** Файлы, на которые не ссылается ни одна ссылка, удаляются не раньше, чем через сутки. */
const ASSET_CLEANUP_INTERVAL_MS = 60 * 60 * 1000
/** Сколько публикаций и удалений с одного адреса в минуту; файлов холста — больше. */
const RATE_LIMIT_PER_MINUTE = 40
const ASSET_RATE_LIMIT_PER_MINUTE = 1500

const ID_FORMAT = /^[\w-]{16,64}$/
const SCREEN_ID_FORMAT = /^[\w-]{1,64}$/
const HASH_FORMAT = /^[0-9a-f]{64}$/
const FRAMES = new Set(['phone', 'tablet', 'window', 'browser', 'none'])
const MAX_NAME_LENGTH = 120

if (!DATABASE_URL) {
  console.error('DATABASE_URL is not set')
  process.exit(1)
}

const db = new pg.Pool({
  connectionString: DATABASE_URL,
  // Для проверки на встроенной базе с одним подключением; на сервере — по умолчанию.
  ...(process.env.DATABASE_POOL_SIZE && { max: Number(process.env.DATABASE_POOL_SIZE) }),
  ssl: /\.railway\.internal|localhost|127\.0\.0\.1/.test(DATABASE_URL)
    ? false
    : { rejectUnauthorized: false }
})

await db.query(`
  CREATE TABLE IF NOT EXISTS shares (
    id text PRIMARY KEY,
    token_hash text NOT NULL,
    manifest jsonb NOT NULL,
    vendor text NOT NULL,
    created_at timestamptz NOT NULL DEFAULT now(),
    updated_at timestamptz NOT NULL DEFAULT now()
  );
  CREATE TABLE IF NOT EXISTS share_docs (
    share_id text NOT NULL REFERENCES shares(id) ON DELETE CASCADE,
    screen_id text NOT NULL,
    html text NOT NULL,
    PRIMARY KEY (share_id, screen_id)
  );
  CREATE TABLE IF NOT EXISTS share_styles (
    hash text PRIMARY KEY,
    css text NOT NULL
  );
  ALTER TABLE share_docs ADD COLUMN IF NOT EXISTS thumb bytea;
  CREATE TABLE IF NOT EXISTS share_assets (
    hash text PRIMARY KEY,
    type text NOT NULL,
    data bytea NOT NULL,
    created_at timestamptz NOT NULL DEFAULT now()
  );
  CREATE TABLE IF NOT EXISTS share_asset_links (
    share_id text NOT NULL REFERENCES shares(id) ON DELETE CASCADE,
    hash text NOT NULL,
    PRIMARY KEY (share_id, hash)
  );
  CREATE INDEX IF NOT EXISTS share_asset_links_hash ON share_asset_links (hash);
  ALTER TABLE shares ALTER COLUMN vendor DROP NOT NULL;
  DROP TABLE IF EXISTS share_vendor;
`)

const viewerHtml = await readFile(new URL('./viewer.html', import.meta.url), 'utf8')

class HttpError extends Error {
  /** `details` уходят в ответ вместе с текстом ошибки, например список недостающих файлов. */
  constructor(status, message, details = {}) {
    super(message)
    this.status = status
    this.details = details
  }
}

const sha256 = (text) => createHash('sha256').update(text).digest('hex')

/** Сравнение секретов за постоянное время. */
function sameSecret(a, b) {
  const left = Buffer.from(a)
  const right = Buffer.from(b)
  return left.length === right.length && timingSafeEqual(left, right)
}

const hits = new Map()
function limited(request, bucket = 'shares', max = RATE_LIMIT_PER_MINUTE) {
  const address = String(request.headers['x-forwarded-for'] ?? request.socket.remoteAddress ?? '')
    .split(',')[0]
    .trim()
  const minute = Math.floor(Date.now() / 60000)
  const key = `${bucket} ${address}`
  const entry = hits.get(key)
  if (!entry || entry.minute !== minute) {
    hits.set(key, { minute, count: 1 })
    if (hits.size > 5000) {
      for (const [other, value] of hits) {
        if (value.minute !== minute) hits.delete(other)
      }
    }
    return false
  }
  entry.count += 1
  return entry.count > max
}

async function readRaw(request, limit) {
  const chunks = []
  let size = 0
  for await (const chunk of request) {
    size += chunk.length
    if (size > limit) {
      throw new HttpError(413, 'The canvas is too large to share.')
    }
    chunks.push(chunk)
  }
  return Buffer.concat(chunks)
}

async function readBody(request) {
  let body = await readRaw(request, MAX_BODY_BYTES)
  if (request.headers['content-encoding'] === 'gzip') {
    body = await gunzipAsync(body, { maxOutputLength: MAX_UNPACKED_BYTES }).catch(() => {
      throw new HttpError(413, 'The canvas is too large to share.')
    })
  }
  try {
    return JSON.parse(body.toString('utf8'))
  } catch {
    throw new HttpError(400, 'The request is not valid JSON.')
  }
}

const isObject = (value) => typeof value === 'object' && value !== null && !Array.isArray(value)
const isNumber = (value) => typeof value === 'number' && Number.isFinite(value)

function text(value, field) {
  if (typeof value !== 'string' || !value.trim() || value.length > MAX_NAME_LENGTH) {
    throw new HttpError(400, `Invalid ${field}.`)
  }
  return value
}

function parseScreen(screen) {
  if (
    !isObject(screen) ||
    !SCREEN_ID_FORMAT.test(screen.id) ||
    !FRAMES.has(screen.frame) ||
    !Number.isInteger(screen.width) ||
    !Number.isInteger(screen.height) ||
    screen.width < 1 ||
    screen.height < 1 ||
    !isNumber(screen.x) ||
    !isNumber(screen.y) ||
    !Number.isInteger(screen.revision)
  ) {
    throw new HttpError(400, 'Invalid screen.')
  }
  return {
    id: screen.id,
    name: text(screen.name, 'screen name'),
    frame: screen.frame,
    width: screen.width,
    height: screen.height,
    x: screen.x,
    y: screen.y,
    revision: screen.revision,
    device: typeof screen.device === 'string' ? screen.device.slice(0, 60) : ''
  }
}

/** Группы и связи страницы: остаются только те, что ссылаются на экраны этой же страницы. */
function parseGroups(raw, ids) {
  return (Array.isArray(raw) ? raw : []).flatMap((group) => {
    if (!isObject(group) || !Array.isArray(group.screens)) return []
    const members = group.screens.filter((id) => ids.has(id))
    return members.length > 0 && SCREEN_ID_FORMAT.test(group.id)
      ? [{ id: group.id, name: text(group.name, 'group name'), screens: members }]
      : []
  })
}

function parseLinks(raw, ids) {
  return (Array.isArray(raw) ? raw : []).flatMap((link) => {
    if (!isObject(link) || !ids.has(link.from) || !ids.has(link.to) || link.from === link.to) {
      return []
    }
    const anchor = link.anchor
    return [
      {
        id: String(link.id).slice(0, 64),
        from: link.from,
        to: link.to,
        anchor:
          isObject(anchor) && ['x', 'y', 'width', 'height'].every((key) => isNumber(anchor[key]))
            ? { x: anchor.x, y: anchor.y, width: anchor.width, height: anchor.height }
            : null
      }
    ]
  })
}

/** Старый холст без страниц — одна страница с его экранами. */
const LEGACY_PAGE_ID = 'main'
const legacyPage = (canvas) => ({
  id: LEGACY_PAGE_ID,
  name: canvas.name,
  screens: canvas.screens,
  groups: canvas.groups,
  links: canvas.links
})

/**
 * Холст из запроса: только то, что нужно странице просмотра, и в известной форме —
 * `{ name, pages: [{ id, name, screens, groups, links }] }`. Старые приложения присылают холст
 * без страниц: он становится одной страницей. Пустые страницы не публикуются.
 */
function parseCanvas(raw) {
  if (!isObject(raw)) {
    throw new HttpError(400, 'The canvas has no screens.')
  }
  const name = text(raw.name, 'canvas name')
  const rawPages = Array.isArray(raw.pages)
    ? raw.pages
    : Array.isArray(raw.screens)
      ? [legacyPage({ ...raw, name })]
      : []
  if (rawPages.length > MAX_PAGES) {
    throw new HttpError(400, `A shared canvas has at most ${MAX_PAGES} pages.`)
  }
  const total = rawPages.reduce(
    (sum, page) => sum + (isObject(page) && Array.isArray(page.screens) ? page.screens.length : 0),
    0
  )
  if (total > MAX_SCREENS) {
    throw new HttpError(400, `A shared canvas has at most ${MAX_SCREENS} screens.`)
  }
  const pageIds = new Set()
  const screenIds = new Set()
  const pages = rawPages.flatMap((page) => {
    if (!isObject(page) || !SCREEN_ID_FORMAT.test(page.id)) {
      throw new HttpError(400, 'Invalid page.')
    }
    if (pageIds.has(page.id)) {
      throw new HttpError(400, 'Page ids repeat.')
    }
    pageIds.add(page.id)
    const pageName = text(page.name, 'page name')
    const screens = (Array.isArray(page.screens) ? page.screens : []).map(parseScreen)
    if (screens.length === 0) return []
    const ids = new Set()
    for (const { id } of screens) {
      if (screenIds.has(id)) throw new HttpError(400, 'Screen ids repeat.')
      screenIds.add(id)
      ids.add(id)
    }
    return [
      {
        id: page.id,
        name: pageName,
        screens,
        groups: parseGroups(page.groups, ids),
        links: parseLinks(page.links, ids)
      }
    ]
  })
  if (pages.length === 0) {
    throw new HttpError(400, 'The canvas has no screens.')
  }
  return { name, pages }
}

/** Сохранённый холст в форме со страницами: ссылки, опубликованные до страниц, хранят старую. */
function normalizeManifest(manifest) {
  if (Array.isArray(manifest?.pages)) return manifest
  return {
    name: manifest?.name ?? '',
    pages: [
      legacyPage({
        name: manifest?.name ?? '',
        screens: Array.isArray(manifest?.screens) ? manifest.screens : [],
        groups: Array.isArray(manifest?.groups) ? manifest.groups : [],
        links: Array.isArray(manifest?.links) ? manifest.links : []
      })
    ]
  }
}

/** Стили страниц экранов: общие у экранов, ключ — sha-256 текста (служба его проверяет). */
function parseStyles(raw) {
  if (!isObject(raw)) {
    throw new HttpError(400, 'This version of Atox can no longer share. Update Atox and try again.')
  }
  const entries = Object.entries(raw)
  // Новые версии Atox кладут стили отдельными файлами: тогда здесь пусто.
  if (entries.length > MAX_STYLES) {
    throw new HttpError(400, 'Invalid styles.')
  }
  return entries.map(([hash, css]) => {
    if (typeof css !== 'string' || css.length > MAX_STYLE_BYTES || sha256(css) !== hash) {
      throw new HttpError(400, 'Invalid styles.')
    }
    return { hash, css }
  })
}

/** Файлы, на которые ссылаются страницы экранов: хеши sha-256 без повторов. */
function parseAssetList(raw) {
  if (raw === undefined) return []
  if (!Array.isArray(raw) || raw.length > MAX_ASSETS_PER_SHARE) {
    throw new HttpError(400, 'Invalid list of files.')
  }
  if (!raw.every((hash) => typeof hash === 'string' && HASH_FORMAT.test(hash))) {
    throw new HttpError(400, 'Invalid list of files.')
  }
  return [...new Set(raw)]
}

/** Каких файлов из списка у службы ещё нет: их и нужно прислать. */
async function missingAssets(request) {
  const body = await readBody(request)
  const hashes = parseAssetList(isObject(body) ? body.hashes : undefined)
  if (hashes.length === 0) return []
  const { rows } = await db.query('SELECT hash FROM share_assets WHERE hash = ANY($1)', [hashes])
  const present = new Set(rows.map(({ hash }) => hash))
  return hashes.filter((hash) => !present.has(hash))
}

/** Кладёт файл по его хешу; тот же файл второй раз не пишется. */
async function putAsset(request, hash) {
  const type = String(request.headers['content-type'] ?? '').split(';')[0].trim().toLowerCase()
  if (!ASSET_TYPES.test(type)) {
    throw new HttpError(415, 'This kind of file cannot be shared.')
  }
  const data = await readRaw(request, MAX_ASSET_BYTES)
  if (data.length === 0 || sha256(data) !== hash) {
    throw new HttpError(400, 'The file does not match its hash.')
  }
  await db.query(
    'INSERT INTO share_assets (hash, type, data) VALUES ($1, $2, $3) ON CONFLICT DO NOTHING',
    [hash, type, data]
  )
}

/** Удаляет файлы, на которые больше не ссылается ни одна ссылка. */
async function cleanupAssets() {
  await db.query(`
    DELETE FROM share_assets a
    WHERE a.created_at < now() - interval '1 day'
      AND NOT EXISTS (SELECT 1 FROM share_asset_links l WHERE l.hash = a.hash)
  `)
}
setInterval(() => {
  cleanupAssets().catch((error) => console.error('Failed to clean up shared files', error))
}, ASSET_CLEANUP_INTERVAL_MS).unref()

/** Публикация: создаёт ссылку или обновляет свою (тот же секрет). */
async function publish(request, id) {
  const token = /^Bearer (\S{20,200})$/.exec(request.headers.authorization ?? '')?.[1]
  if (!token) {
    throw new HttpError(401, 'The share key is missing.')
  }
  const body = await readBody(request)
  if (!isObject(body) || !isObject(body.docs)) {
    throw new HttpError(400, 'The request has no screens.')
  }
  const canvas = parseCanvas(body.canvas)
  const docs = canvas.pages.flatMap((page) => page.screens).map((screen) => {
    const html = body.docs[screen.id]
    if (typeof html !== 'string' || html.length === 0 || html.length > MAX_DOC_BYTES) {
      throw new HttpError(400, `The screen "${screen.name}" has no page or its page is too large.`)
    }
    return { screenId: screen.id, html }
  })
  const styles = parseStyles(body.styles)
  const assets = parseAssetList(body.assets)
  const thumbs = isObject(body.thumbs) ? body.thumbs : {}
  for (const doc of docs) {
    const thumb = thumbs[doc.screenId]
    const content = typeof thumb === 'string' ? Buffer.from(thumb, 'base64') : null
    doc.thumb = content && content.length > 0 && content.length <= MAX_THUMB_BYTES ? content : null
  }

  const client = await db.connect()
  try {
    await client.query('BEGIN')
    const existing = (
      await client.query('SELECT token_hash FROM shares WHERE id = $1 FOR UPDATE', [id])
    ).rows[0]
    if (existing && !sameSecret(existing.token_hash, sha256(token))) {
      throw new HttpError(403, 'This link belongs to someone else.')
    }
    if (!existing) {
      const { rows } = await client.query('SELECT count(*)::int AS count FROM shares')
      if (rows[0].count >= MAX_SHARES) {
        throw new HttpError(503, 'Sharing is full right now. Try again later.')
      }
    }
    if (assets.length > 0) {
      const { rows } = await client.query('SELECT hash FROM share_assets WHERE hash = ANY($1)', [
        assets
      ])
      const present = new Set(rows.map(({ hash }) => hash))
      const missing = assets.filter((hash) => !present.has(hash))
      if (missing.length > 0) {
        throw new HttpError(409, 'Some files of the canvas are missing.', { missing })
      }
    }
    for (const { hash, css } of styles) {
      await client.query(
        'INSERT INTO share_styles (hash, css) VALUES ($1, $2) ON CONFLICT DO NOTHING',
        [hash, css]
      )
    }
    await client.query(
      `INSERT INTO shares (id, token_hash, manifest) VALUES ($1, $2, $3)
       ON CONFLICT (id) DO UPDATE SET manifest = $3, vendor = NULL, updated_at = now()`,
      [id, sha256(token), JSON.stringify(canvas)]
    )
    await client.query('DELETE FROM share_asset_links WHERE share_id = $1', [id])
    await client.query(
      'INSERT INTO share_asset_links (share_id, hash) SELECT $1, unnest($2::text[])',
      [id, assets]
    )
    await client.query('DELETE FROM share_docs WHERE share_id = $1', [id])
    await client.query(
      `INSERT INTO share_docs (share_id, screen_id, html, thumb)
       SELECT $1, screen_id, html, thumb
       FROM unnest($2::text[], $3::text[], $4::bytea[]) AS doc(screen_id, html, thumb)`,
      [
        id,
        docs.map(({ screenId }) => screenId),
        docs.map(({ html }) => html),
        docs.map(({ thumb }) => thumb)
      ]
    )
    await client.query('COMMIT')
  } catch (error) {
    await client.query('ROLLBACK').catch(() => {})
    throw error
  } finally {
    client.release()
  }
}

async function unpublish(request, id) {
  const token = /^Bearer (\S{20,200})$/.exec(request.headers.authorization ?? '')?.[1]
  const row = (await db.query('SELECT token_hash FROM shares WHERE id = $1', [id])).rows[0]
  if (!row) {
    return
  }
  if (!token || !sameSecret(row.token_hash, sha256(token))) {
    throw new HttpError(403, 'This link belongs to someone else.')
  }
  await db.query('DELETE FROM shares WHERE id = $1', [id])
}

const escapeHtml = (value) => value.replace(/[&<>"']/g, (char) => `&#${char.charCodeAt(0)};`)

const COMMON_HEADERS = {
  'X-Content-Type-Options': 'nosniff',
  'Referrer-Policy': 'no-referrer',
  'X-Robots-Tag': 'noindex, nofollow'
}

/**
 * Страница экрана — статичный снимок в песочнице: свои стили по адресу службы, единственный
 * встроенный скрипт (прокрутка), картинки только встроенные; сети и чужих скриптов нет.
 */
const SCREEN_POLICY = [
  "default-src 'none'",
  "script-src 'unsafe-inline'",
  "style-src 'self' 'unsafe-inline'",
  "img-src 'self' data: blob:",
  "font-src 'self' data:",
  'media-src data:',
  "connect-src 'none'",
  "form-action 'none'",
  "base-uri 'none'",
  "frame-ancestors 'self'"
].join('; ')

const VIEWER_POLICY = [
  "default-src 'none'",
  "script-src 'unsafe-inline'",
  "style-src 'unsafe-inline'",
  "img-src 'self' data:",
  "connect-src 'self'",
  "frame-src 'self'",
  "base-uri 'none'",
  "form-action 'none'",
  "frame-ancestors 'none'"
].join('; ')

function send(response, status, body, headers = {}) {
  response.writeHead(status, { ...COMMON_HEADERS, ...headers })
  response.end(body)
}

function sendJson(response, status, value) {
  send(response, status, JSON.stringify(value), {
    'Content-Type': 'application/json; charset=utf-8',
    'Cache-Control': 'no-store'
  })
}

function notFoundPage(response) {
  send(
    response,
    404,
    `<!doctype html><meta charset="utf-8"><meta name="viewport" content="width=device-width, initial-scale=1"><title>Not found</title><style>body{margin:0;min-height:100vh;display:grid;place-items:center;font:16px -apple-system,BlinkMacSystemFont,sans-serif;color:#777586;background:#f3f2f7}@media(prefers-color-scheme:dark){body{background:#1c1c1e;color:#8e8e93}}</style><p>This link is no longer available.</p>`,
    { 'Content-Type': 'text/html; charset=utf-8', 'Cache-Control': 'no-store' }
  )
}

async function handle(request, response) {
  const url = new URL(request.url ?? '/', 'http://localhost')
  const parts = url.pathname.split('/').filter(Boolean)
  const method = request.method ?? 'GET'

  if (url.pathname === '/healthz') {
    return send(response, 200, 'ok', { 'Content-Type': 'text/plain' })
  }

  if (parts[0] === 'api') {
    if (parts[1] === 'assets' && parts.length === 3 && parts[2] === 'missing' && method === 'POST') {
      if (limited(request, 'assets', ASSET_RATE_LIMIT_PER_MINUTE)) {
        throw new HttpError(429, 'Too many requests. Try again in a minute.')
      }
      return sendJson(response, 200, { missing: await missingAssets(request) })
    }
    if (parts[1] === 'assets' && parts.length === 3 && HASH_FORMAT.test(parts[2]) && method === 'PUT') {
      if (limited(request, 'assets', ASSET_RATE_LIMIT_PER_MINUTE)) {
        throw new HttpError(429, 'Too many requests. Try again in a minute.')
      }
      await putAsset(request, parts[2])
      return sendJson(response, 200, { ok: true })
    }
    if (parts[1] === 'shares' && parts[2] && ID_FORMAT.test(parts[2])) {
      if (method === 'PUT' || method === 'DELETE') {
        if (limited(request)) throw new HttpError(429, 'Too many requests. Try again in a minute.')
        if (method === 'PUT') {
          await publish(request, parts[2])
        } else {
          await unpublish(request, parts[2])
        }
        return sendJson(response, 200, { ok: true })
      }
    }
    throw new HttpError(404, 'Not found')
  }

  if (method !== 'GET' && method !== 'HEAD') {
    throw new HttpError(405, 'Method not allowed')
  }

  if (parts.length === 0) {
    return send(response, 302, '', { Location: HOME_URL })
  }

  if (parts[0] === 'a' && parts.length === 2 && HASH_FORMAT.test(parts[1])) {
    const row = (await db.query('SELECT type, data FROM share_assets WHERE hash = $1', [parts[1]]))
      .rows[0]
    if (!row) throw new HttpError(404, 'Not found')
    // Файл открывается только как часть страницы экрана: сам по себе ничего не исполняет.
    return send(response, 200, row.data, {
      'Content-Type': row.type === 'text/css' ? 'text/css; charset=utf-8' : row.type,
      'Content-Security-Policy': "default-src 'none'; style-src 'unsafe-inline'; sandbox",
      'Cache-Control': 'public, max-age=31536000, immutable',
      'Access-Control-Allow-Origin': '*'
    })
  }

  if (parts[0] === 'c' && parts.length === 2 && parts[1].endsWith('.css')) {
    const hash = parts[1].slice(0, -'.css'.length)
    if (!HASH_FORMAT.test(hash)) throw new HttpError(404, 'Not found')
    const row = (await db.query('SELECT css FROM share_styles WHERE hash = $1', [hash])).rows[0]
    if (!row) throw new HttpError(404, 'Not found')
    return send(response, 200, row.css, {
      'Content-Type': 'text/css; charset=utf-8',
      'Cache-Control': 'public, max-age=31536000, immutable',
      'Access-Control-Allow-Origin': '*'
    })
  }

  const id = parts[0]
  if (!ID_FORMAT.test(id)) {
    throw new HttpError(404, 'Not found')
  }

  if (parts.length === 1) {
    const row = (await db.query('SELECT manifest FROM shares WHERE id = $1', [id])).rows[0]
    if (!row) return notFoundPage(response)
    const title = `${escapeHtml(String(row.manifest?.name ?? ''))} · Atox`
    return send(response, 200, viewerHtml.replace('<title>Atox</title>', `<title>${title}</title>`), {
      'Content-Type': 'text/html; charset=utf-8',
      'Content-Security-Policy': VIEWER_POLICY,
      'Cache-Control': 'no-store'
    })
  }

  if (parts.length === 2 && parts[1] === 'data') {
    const row = (
      await db.query('SELECT manifest, updated_at FROM shares WHERE id = $1', [id])
    ).rows[0]
    if (!row) throw new HttpError(404, 'Not found')
    return sendJson(response, 200, {
      canvas: normalizeManifest(row.manifest),
      updatedAt: row.updated_at
    })
  }

  if (parts.length === 3 && parts[1] === 't' && SCREEN_ID_FORMAT.test(parts[2])) {
    const row = (
      await db.query('SELECT thumb FROM share_docs WHERE share_id = $1 AND screen_id = $2', [
        id,
        parts[2]
      ])
    ).rows[0]
    if (!row?.thumb) throw new HttpError(404, 'Not found')
    // Адрес картинки содержит время публикации: новая публикация — новый адрес.
    return send(response, 200, row.thumb, {
      'Content-Type': 'image/jpeg',
      'Cache-Control': 'public, max-age=86400'
    })
  }

  if (parts.length === 3 && parts[1] === 's' && SCREEN_ID_FORMAT.test(parts[2])) {
    const row = (
      await db.query('SELECT html FROM share_docs WHERE share_id = $1 AND screen_id = $2', [
        id,
        parts[2]
      ])
    ).rows[0]
    if (!row) throw new HttpError(404, 'Not found')
    return send(response, 200, row.html, {
      'Content-Type': 'text/html; charset=utf-8',
      'Content-Security-Policy': SCREEN_POLICY,
      'Cache-Control': 'public, max-age=86400'
    })
  }

  throw new HttpError(404, 'Not found')
}

createServer((request, response) => {
  handle(request, response).catch((error) => {
    if (response.headersSent) {
      response.end()
      return
    }
    if (error instanceof HttpError) {
      return sendJson(response, error.status, { ...error.details, error: error.message })
    }
    console.error('Request failed', error)
    sendJson(response, 500, { error: 'Something went wrong.' })
  })
}).listen(PORT, () => console.log(`Atox share is listening on ${PORT}`))
