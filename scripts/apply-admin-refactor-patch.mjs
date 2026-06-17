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
const patchPath = path.join(root, 'database', 'postgres', 'patch_admin_refactor.sql')
const body = readFileSync(patchPath, 'utf8')
  .replace(/^BEGIN;\s*/m, '')
  .replace(/COMMIT;\s*/m, '')
  .trim()

const statements = body
  .split(/;\s*\n/)
  .map((s) => s.trim())
  .filter((s) => s && !s.startsWith('--'))

try {
  for (const stmt of statements) {
    const rows = await sql.unsafe(stmt)
    if (Array.isArray(rows) && rows.length) {
      console.log(rows)
    }
  }

  const users = await sql`
    SELECT u.email, u.employee_id, r.role_slug, e.emp_number, e.first_name, e.last_name
    FROM users u
    INNER JOIN roles r ON r.role_id = u.role_id
    LEFT JOIN employees e ON e.id = u.employee_id
    ORDER BY u.id
  `
  console.log('Users after patch:', users)

  const hgAdm = await sql`SELECT id, emp_number FROM employees WHERE emp_number = 'HG-ADM'`
  console.log('HG-ADM employee rows:', hgAdm.length ? hgAdm : '(none)')
} finally {
  await sql.end()
}
