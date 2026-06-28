import fs from 'fs'
import path from 'path'
import { fileURLToPath, pathToFileURL } from 'url'
import { createRequire } from 'module'

const require = createRequire(pathToFileURL(path.join(path.dirname(fileURLToPath(import.meta.url)), '..', 'server', 'package.json')))
const postgres = require('postgres')
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
if (!url) { console.error('DATABASE_URL not found'); process.exit(1) }

// ---- Config -----------------------------------------------------------------
const MANILA_OFFSET_MS = 8 * 60 * 60 * 1000
const YEAR = 2026
const MONTH = 6 // June (1-based)
const BRANCH_LAT = 15.1458
const BRANCH_LNG = 120.5906
const ADDRESS = 'Highway Grill, MacArthur Highway, Pampanga'

// Scheduled shift (Manila wall clock): 08:00–17:00 with a 12:00–13:00 break.
const SHIFT_START_MIN = 8 * 60
const SHIFT_END_MIN = 17 * 60
const BREAK_START_MIN = 12 * 60
const BREAK_END_MIN = 13 * 60
const BREAK_MINUTES = BREAK_END_MIN - BREAK_START_MIN

const EMPLOYEES = [
  { id: 4, name: 'DARRYL JOHN REYES', restDow: 0 }, // rests Sunday
  { id: 2, name: 'Jeanwin Ortega', restDow: 1 }, // rests Monday
]

// ---- Helpers ----------------------------------------------------------------
function rand(min, max) {
  return Math.random() * (max - min) + min
}
function randInt(min, max) {
  return Math.floor(rand(min, max + 1))
}
function chance(p) {
  return Math.random() < p
}
function round2(n) {
  return Math.round(n * 100) / 100
}
function pad2(n) {
  return String(n).padStart(2, '0')
}

// Manila wall-clock (date + minutes from midnight) → UTC Date for TIMESTAMPTZ.
function manilaToUtc(y, m, d, minutesFromMidnight) {
  const hh = Math.floor(minutesFromMidnight / 60)
  const mm = minutesFromMidnight % 60
  return new Date(Date.UTC(y, m - 1, d, hh, mm, 0) - MANILA_OFFSET_MS)
}

function daysInMonth(y, m) {
  return new Date(y, m, 0).getDate()
}

function dowManila(y, m, d) {
  // Day-of-week for the Manila calendar date (0 = Sunday).
  return new Date(Date.UTC(y, m - 1, d)).getUTCDay()
}

// Build one day's attendance values, or null for a rest/absent day.
function buildDay(emp, y, m, d) {
  const dow = dowManila(y, m, d)
  if (dow === emp.restDow) return null // weekly rest day → no record
  if (chance(0.06)) return null // occasional unplanned absence

  // Clock in: mostly on time, sometimes late, sometimes early.
  let inOffset
  const roll = Math.random()
  if (roll < 0.6) inOffset = randInt(-5, 5)
  else if (roll < 0.85) inOffset = randInt(6, 25) // late
  else inOffset = randInt(-20, -6) // early
  const clockInMin = SHIFT_START_MIN + inOffset

  // Clock out: chance of overtime, else on time, occasionally early.
  let otHours = 0
  let earlyOut = 0
  if (chance(0.3)) {
    otHours = [1, 1.5, 2, 3][randInt(0, 3)]
  } else if (chance(0.12)) {
    earlyOut = randInt(10, 45)
  }
  const clockOutMin = SHIFT_END_MIN + Math.round(otHours * 60) - earlyOut

  const grossMin = clockOutMin - clockInMin
  const workedMin = grossMin - BREAK_MINUTES
  const actualHours = round2(workedMin / 60)
  const regularHours = round2(Math.min(8, actualHours))
  const overtimeHours = round2(Math.max(0, otHours))

  const lateIn = Math.max(0, inOffset)
  const earlyIn = Math.max(0, -inOffset)
  const lateOut = Math.max(0, Math.round(otHours * 60))
  const earlyOutMin = Math.max(0, earlyOut)

  return {
    clock_in: manilaToUtc(y, m, d, clockInMin),
    clock_out: manilaToUtc(y, m, d, clockOutMin),
    break_start: manilaToUtc(y, m, d, BREAK_START_MIN),
    break_end: manilaToUtc(y, m, d, BREAK_END_MIN),
    actual_hours: actualHours,
    regular_hours: regularHours,
    overtime_hours: overtimeHours,
    early_in_minutes: earlyIn,
    late_in_minutes: lateIn,
    early_out_minutes: earlyOutMin,
    late_out_minutes: lateOut,
    request_date: `${y}-${pad2(m)}-${pad2(d)}`,
  }
}

// ---- Run --------------------------------------------------------------------
const sql = postgres(url, { max: 1 })
const totalDays = daysInMonth(YEAR, MONTH)

try {
  await sql.begin(async (tx) => {
    // 1. Wipe all attendance (and OT requests, which derive from attendance).
    await tx`DELETE FROM overtime_requests`
    const del = await tx`DELETE FROM attendance`
    console.log(`Deleted ${del.count} attendance rows and all overtime requests.`)

    // 2. Seed a full month for each employee.
    for (const emp of EMPLOYEES) {
      let worked = 0
      let otDays = 0
      for (let d = 1; d <= totalDays; d++) {
        const day = buildDay(emp, YEAR, MONTH, d)
        if (!day) continue
        worked++

        const [row] = await tx`
          INSERT INTO attendance (
            employee_id, clock_in, clock_out, method,
            latitude, longitude, clock_in_address, clock_out_address,
            break_start, break_end,
            actual_hours, regular_hours, overtime_hours,
            early_in_minutes, late_in_minutes, early_out_minutes, late_out_minutes,
            clock_out_type, created_at
          ) VALUES (
            ${emp.id}, ${day.clock_in}, ${day.clock_out}, 'app',
            ${BRANCH_LAT}, ${BRANCH_LNG}, ${ADDRESS}, ${ADDRESS},
            ${day.break_start}, ${day.break_end},
            ${day.actual_hours}, ${day.regular_hours}, ${day.overtime_hours},
            ${day.early_in_minutes}, ${day.late_in_minutes},
            ${day.early_out_minutes}, ${day.late_out_minutes},
            'manual', ${day.clock_in}
          )
          RETURNING id
        `

        if (day.overtime_hours > 0) {
          otDays++
          await tx`
            INSERT INTO overtime_requests (
              employee_id, request_date, extra_hours, reason, status, source, attendance_id
            ) VALUES (
              ${emp.id}, ${day.request_date}, ${day.overtime_hours},
              'Seeded overtime', 'approved', 'manual', ${row.id}
            )
          `
        }
      }
      console.log(`  ${emp.name} (id=${emp.id}): ${worked} work days, ${otDays} with approved OT.`)
    }
  })

  // 3. Summary readback.
  const summary = await sql`
    SELECT e.first_name, e.last_name,
           COUNT(*)::int AS days,
           ROUND(SUM(a.actual_hours), 2) AS total_hours,
           ROUND(SUM(a.overtime_hours), 2) AS total_ot
    FROM attendance a
    JOIN employees e ON e.id = a.employee_id
    GROUP BY e.id, e.first_name, e.last_name
    ORDER BY e.first_name
  `
  console.log('\nSeeded attendance summary (June 2026):')
  for (const r of summary) {
    console.log(`  ${r.first_name} ${r.last_name}: ${r.days} days, ${r.total_hours}h total, ${r.total_ot}h OT`)
  }
} catch (err) {
  console.error('Seed failed:', err.message || err)
  process.exit(1)
} finally {
  await sql.end()
}
