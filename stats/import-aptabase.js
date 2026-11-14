/**
 * Переносит события из выгрузки Aptabase (Export → CSV) в базу статистики.
 *
 *   DATABASE_URL=… node import-aptabase.js atox-release.csv
 *
 * Повторный запуск с новой выгрузкой заменяет прошлый перенос целиком, поэтому события
 * не задваиваются.
 */
import { readFile } from 'node:fs/promises'
import pg from 'pg'

const SOURCE = 'aptabase'
const EVENTS = new Set(['install', 'daily_active', 'weekly_active', 'monthly_active'])

/** Разбор CSV с полями в кавычках и `""` внутри них. */
function parseCsv(text) {
  const rows = []
  let row = []
  let field = ''
  let quoted = false
  for (let index = 0; index < text.length; index += 1) {
    const char = text[index]
    if (quoted) {
      if (char === '"' && text[index + 1] === '"') {
        field += '"'
        index += 1
      } else if (char === '"') {
        quoted = false
      } else {
        field += char
      }
    } else if (char === '"') {
      quoted = true
    } else if (char === ',') {
      row.push(field)
      field = ''
    } else if (char === '\n' || char === '\r') {
      if (char === '\r' && text[index + 1] === '\n') index += 1
      row.push(field)
      if (row.some((value) => value !== '')) rows.push(row)
      row = []
      field = ''
    } else {
      field += char
    }
  }
  row.push(field)
  if (row.some((value) => value !== '')) rows.push(row)
  const [header, ...records] = rows
  return records.map((values) => Object.fromEntries(header.map((name, i) => [name, values[i] ?? ''])))
}

const [file] = process.argv.slice(2)
if (!file || !process.env.DATABASE_URL) {
  console.error('Usage: DATABASE_URL=… node import-aptabase.js <export.csv>')
  process.exit(1)
}

const records = parseCsv(await readFile(file, 'utf8'))
const events = records.filter((record) => EVENTS.has(record.event_name))
const skipped = records.length - events.length

const db = new pg.Client({
  connectionString: process.env.DATABASE_URL,
  ssl: /\.railway\.internal|localhost|127\.0\.0\.1/.test(process.env.DATABASE_URL)
    ? false
    : { rejectUnauthorized: false }
})
await db.connect()
try {
  await db.query('BEGIN')
  const removed = await db.query('DELETE FROM usage_events WHERE source = $1', [SOURCE])
  for (const record of events) {
    await db.query(
      `INSERT INTO usage_events (name, version, os, country, session_id, source, created_at)
       VALUES ($1, $2, $3, $4, $5, $6, $7)`,
      [
        record.event_name,
        record.app_version || null,
        record.os_name || null,
        record.country_code || null,
        record.session_id || null,
        SOURCE,
        // Aptabase выгружает время в UTC без пояса.
        `${record.timestamp.replace(' ', 'T')}Z`
      ]
    )
  }
  await db.query('COMMIT')
  console.log(
    `Imported ${events.length} events (replaced ${removed.rowCount}${skipped ? `, skipped ${skipped} unknown` : ''})`
  )
} catch (error) {
  await db.query('ROLLBACK')
  throw error
} finally {
  await db.end()
}
