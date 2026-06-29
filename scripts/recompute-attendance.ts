import fs from 'fs'
import path from 'path'
import { fileURLToPath } from 'url'

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..')

function loadDatabaseUrl() {
  if (process.env.DATABASE_URL) return process.env.DATABASE_URL.trim()
  for (const file of ['.env', path.join('server', '.env.local')]) {
    const p = path.join(root, file)
    if (!fs.existsSync(p)) continue
    const line = fs.readFileSync(p, 'utf8').split(/\r?\n/).find((l) => /^DATABASE_URL=/.test(l))
    if (line) return line.replace(/^DATABASE_URL=/, '').trim().replace(/^["']|["']$/g, '')
  }
  return null
}

const url = loadDatabaseUrl()
if (url) process.env.DATABASE_URL = url

const from = process.argv[2] ?? '2026-06-01'
const to = process.argv[3] ?? '2026-06-30'

const { recomputeAttendanceBatch } = await import('../server/lib/attendance-auto')
const result = await recomputeAttendanceBatch({ from, to })
console.log(`Recomputed attendance ${from} – ${to}:`, result)
