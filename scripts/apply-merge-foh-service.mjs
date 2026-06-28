import fs from 'fs'
import path from 'path'
import { fileURLToPath, pathToFileURL } from 'url'
import { createRequire } from 'module'

const require = createRequire(pathToFileURL(path.join(path.dirname(fileURLToPath(import.meta.url)), '..', 'server', 'package.json')))
const postgres = require('postgres')

const __dirname = path.dirname(fileURLToPath(import.meta.url))
const root = path.resolve(__dirname, '..')

function loadDatabaseUrl() {
  if (process.env.DATABASE_URL) return process.env.DATABASE_URL.trim()
  for (const file of ['.env', path.join('server', '.env.local')]) {
    const p = path.join(root, file)
    if (!fs.existsSync(p)) continue
    const line = fs
      .readFileSync(p, 'utf8')
      .split(/\r?\n/)
      .find((l) => /^DATABASE_URL=/.test(l))
    if (line) return line.replace(/^DATABASE_URL=/, '').trim().replace(/^["']|["']$/g, '')
  }
  return null
}

const url = loadDatabaseUrl()
if (!url) {
  console.error('DATABASE_URL not found')
  process.exit(1)
}

const sql = postgres(url, { max: 1 })
try {
  const body = fs.readFileSync(path.join(root, 'database/postgres/patch_merge_foh_into_service.sql'), 'utf8')
  const result = await sql.unsafe(body)
  console.log('OK: patch_merge_foh_into_service.sql')
  const rows = Array.isArray(result) ? result : []
  if (rows.length) {
    console.log('Service department now contains:')
    for (const r of rows) console.log(`  - ${r.title} (${r.pay_grade ?? 'n/a'})${r.is_tipped ? ' [tipped]' : ''}`)
  }
} catch (err) {
  console.error(err.message || err)
  process.exit(1)
} finally {
  await sql.end()
}
