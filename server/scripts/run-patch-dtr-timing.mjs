import fs from 'fs'
import path from 'path'
import { fileURLToPath } from 'url'
import postgres from 'postgres'

const __dirname = path.dirname(fileURLToPath(import.meta.url))
const serverRoot = path.join(__dirname, '..')

function loadEnvFile(filePath) {
  if (!fs.existsSync(filePath)) return
  for (const line of fs.readFileSync(filePath, 'utf8').split(/\r?\n/)) {
    const m = line.match(/^([^#=]+)=(.*)$/)
    if (m) {
      let val = m[2].trim()
      if ((val.startsWith('"') && val.endsWith('"')) || (val.startsWith("'") && val.endsWith("'"))) {
        val = val.slice(1, -1)
      }
      process.env[m[1].trim()] = val
    }
  }
}

loadEnvFile(path.join(serverRoot, '.env.local'))
loadEnvFile(path.join(serverRoot, '.env'))

const url = process.env.DATABASE_URL
if (!url) {
  console.error('DATABASE_URL not set in server/.env.local')
  process.exit(1)
}

const patchPath = path.join(serverRoot, '..', 'database', 'postgres', 'patch_attendance_dtr_timing.sql')
const patch = fs.readFileSync(patchPath, 'utf8')
const ssl = url.includes('localhost') || url.includes('127.0.0.1') ? false : 'require'
const sql = postgres(url, { ssl, max: 1 })

try {
  const stmts = patch
    .replace(/^--[^\n]*\n/gm, '')
    .split(';')
    .map((s) => s.trim())
    .filter(Boolean)
  for (const stmt of stmts) {
    await sql.unsafe(stmt)
    console.log('Applied:', stmt.split('\n')[0])
  }

  const cols = await sql`
    SELECT column_name FROM information_schema.columns
    WHERE table_name = 'attendance'
      AND column_name IN ('early_in_minutes','late_in_minutes','early_out_minutes','late_out_minutes')
    ORDER BY column_name
  `
  console.log('Verified columns:', cols.map((r) => r.column_name).join(', '))
} finally {
  await sql.end()
}
