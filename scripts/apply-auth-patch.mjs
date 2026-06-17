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
const patchPath = path.join(root, 'database', 'postgres', 'patch_production_auth.sql')
const body = readFileSync(patchPath, 'utf8')
  .replace(/^BEGIN;\s*/m, '')
  .replace(/COMMIT;\s*$/m, '')
  .replace(/SELECT email[\s\S]*$/m, '')
  .trim()

try {
  await sql.unsafe(body)
  const rows = await sql`SELECT email, role_id, left(password_hash, 7) AS hash_prefix FROM users ORDER BY id`
  console.log(rows)
} finally {
  await sql.end()
}
