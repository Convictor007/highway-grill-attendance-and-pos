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

const patches = [
  'database/postgres/patch_benefit_deductions.sql',
  'database/postgres/patch_benefit_optional.sql',
]

const sql = postgres(url, { max: 1 })

try {
  for (const rel of patches) {
    const file = path.join(root, rel)
    const raw = fs.readFileSync(file, 'utf8')
    const body = raw
      .split(/\r?\n/)
      .filter((line) => !/^\s*BEGIN\s*;?\s*$/i.test(line) && !/^\s*COMMIT\s*;?\s*$/i.test(line))
      .join('\n')
    console.log(`Applying ${rel}...`)
    await sql.unsafe(body)
    console.log(`OK: ${rel}`)
  }
  console.log('All benefit patches applied.')
} catch (err) {
  console.error(err.message || err)
  process.exit(1)
} finally {
  await sql.end()
}
