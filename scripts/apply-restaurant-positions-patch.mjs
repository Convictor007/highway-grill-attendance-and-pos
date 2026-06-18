import { readFileSync } from 'fs'
import path from 'path'
import { fileURLToPath } from 'url'
import postgres from '../server/node_modules/postgres/src/index.js'

const root = path.join(path.dirname(fileURLToPath(import.meta.url)), '..')
const envLocal = readFileSync(path.join(root, 'server', '.env.local'), 'utf8')
const match = envLocal.match(/^DATABASE_URL=(.+)$/m)
if (!match) {
  console.error('DATABASE_URL not found in server/.env.local')
  process.exit(1)
}

const sql = postgres(match[1].trim())
const patchPath = path.join(root, 'database', 'postgres', 'patch_restaurant_positions.sql')
function parseSqlStatements(raw) {
  const body = raw
    .replace(/^BEGIN;\s*/m, '')
    .replace(/COMMIT;\s*/m, '')
    .trim()
  const stripped = body
    .split('\n')
    .map((line) => line.replace(/--.*$/, ''))
    .join('\n')
  return stripped
    .split(/;\s*\n/)
    .map((s) => s.trim())
    .filter(Boolean)
}

const statements = parseSqlStatements(readFileSync(patchPath, 'utf8'))

try {
  for (const stmt of statements) {
    const rows = await sql.unsafe(stmt)
    if (Array.isArray(rows) && rows.length) {
      console.log(`(${rows.length} rows)`)
      if (rows.length <= 30) console.table(rows)
    }
  }
} finally {
  await sql.end()
}
