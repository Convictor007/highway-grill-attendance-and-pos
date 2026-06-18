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
  console.error('DATABASE_URL not found in env or .env files')
  process.exit(1)
}

const seedFile = path.join(root, 'database/postgres/seed_benefits.sql')
const raw = fs.readFileSync(seedFile, 'utf8')

const sql = postgres(url, { max: 1 })

try {
  console.log('Running seed_benefits.sql on Neon...')
  const rows = await sql.unsafe(raw)
  const summary = Array.isArray(rows) ? rows[rows.length - 1] : rows
  console.log('OK:', summary)
} catch (err) {
  console.error(err.message || err)
  process.exit(1)
} finally {
  await sql.end()
}
