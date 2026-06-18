import { useEffect, useMemo, useRef, useState } from 'react'
import { usePopoverPosition } from '../hooks/usePopoverPosition'
import { daysInMonth, formatDateDisplay, pad2, todayLocalIsoDate } from '../lib/datetime'

type Props = {
  label?: string
  value: string
  onChange: (value: string) => void
  required?: boolean
  min?: string
  max?: string
  id?: string
  /** @deprecated All pickers use month/year dropdowns. Kept for compatibility. */
  birthDate?: boolean
}

const WEEKDAYS = ['Su', 'Mo', 'Tu', 'We', 'Th', 'Fr', 'Sa']

const MONTH_NAMES = [
  'January', 'February', 'March', 'April', 'May', 'June',
  'July', 'August', 'September', 'October', 'November', 'December',
]

function parseYear(iso?: string, fallback?: number): number {
  if (!iso || iso.length < 4) return fallback ?? new Date().getFullYear()
  const y = Number(iso.slice(0, 4))
  return Number.isFinite(y) ? y : (fallback ?? new Date().getFullYear())
}

function yearRange(min?: string, max?: string): { minYear: number; maxYear: number } {
  const current = new Date().getFullYear()
  let maxYear = max ? parseYear(max, current) : current + 2
  let minYear = min ? parseYear(min, maxYear - 100) : maxYear - 100

  if (min) minYear = parseYear(min, minYear)
  if (max) maxYear = parseYear(max, maxYear)

  if (minYear > maxYear) [minYear, maxYear] = [maxYear, minYear]
  return { minYear, maxYear }
}

export function DatePicker({ label, value, onChange, required, min, max, id }: Props) {
  const [open, setOpen] = useState(false)
  const wrapRef = useRef<HTMLDivElement>(null)
  const triggerRef = useRef<HTMLButtonElement>(null)
  const popoverRef = useRef<HTMLDivElement>(null)
  const popoverPos = usePopoverPosition(open, triggerRef, popoverRef)
  const base = value ? new Date(value + 'T12:00:00') : new Date()
  const [viewYear, setViewYear] = useState(base.getFullYear())
  const [viewMonth, setViewMonth] = useState(base.getMonth())

  const { minYear, maxYear } = useMemo(() => yearRange(min, max), [min, max])

  const yearOptions = useMemo(() => {
    const years: number[] = []
    for (let y = maxYear; y >= minYear; y--) years.push(y)
    return years
  }, [maxYear, minYear])

  const today = todayLocalIsoDate()
  const showToday = !max || max >= today

  useEffect(() => {
    if (!value) return
    const d = new Date(value + 'T12:00:00')
    if (!Number.isNaN(d.getTime())) {
      setViewYear(d.getFullYear())
      setViewMonth(d.getMonth())
    }
  }, [value])

  useEffect(() => {
    setViewYear((y) => Math.min(maxYear, Math.max(minYear, y)))
  }, [minYear, maxYear])

  useEffect(() => {
    if (!open) return
    const onDoc = (e: MouseEvent) => {
      if (wrapRef.current && !wrapRef.current.contains(e.target as Node)) setOpen(false)
    }
    document.addEventListener('mousedown', onDoc)
    return () => document.removeEventListener('mousedown', onDoc)
  }, [open])

  const firstDow = new Date(viewYear, viewMonth, 1).getDay()
  const totalDays = daysInMonth(viewYear, viewMonth)
  const cells: (number | null)[] = []
  for (let i = 0; i < firstDow; i++) cells.push(null)
  for (let d = 1; d <= totalDays; d++) cells.push(d)

  const pick = (day: number) => {
    const iso = `${viewYear}-${pad2(viewMonth + 1)}-${pad2(day)}`
    if (min && iso < min) return
    if (max && iso > max) return
    onChange(iso)
    setOpen(false)
  }

  return (
    <div className="picker-field" ref={wrapRef}>
      {label && (
        <label className="picker-label" htmlFor={id}>
          {label}
        </label>
      )}
      <button
        ref={triggerRef}
        type="button"
        id={id}
        className={`picker-trigger ${open ? 'picker-trigger--open' : ''}`}
        onClick={() => setOpen((o) => !o)}
        aria-expanded={open}
        aria-haspopup="dialog"
      >
        <span>{formatDateDisplay(value)}</span>
      </button>
      {required && !value && <input tabIndex={-1} className="picker-required-proxy" required value="" readOnly />}
      {open && (
        <div
          ref={popoverRef}
          className="picker-popover picker-popover--fixed calendar-popover"
          role="dialog"
          style={{
            top: popoverPos?.top ?? 0,
            left: popoverPos?.left ?? 0,
            maxWidth: popoverPos?.maxWidth ?? 'calc(100vw - 16px)',
            visibility: popoverPos ? 'visible' : 'hidden',
          }}
        >
          <div className="calendar-head calendar-head--pickers">
            <select
              className="calendar-select"
              value={viewMonth}
              aria-label="Month"
              onChange={(e) => setViewMonth(Number(e.target.value))}
            >
              {MONTH_NAMES.map((name, idx) => (
                <option key={name} value={idx}>{name}</option>
              ))}
            </select>
            <select
              className="calendar-select calendar-select--year"
              value={viewYear}
              aria-label="Year"
              onChange={(e) => setViewYear(Number(e.target.value))}
            >
              {yearOptions.map((y) => (
                <option key={y} value={y}>{y}</option>
              ))}
            </select>
          </div>
          <div className="calendar-weekdays">
            {WEEKDAYS.map((w) => (
              <span key={w}>{w}</span>
            ))}
          </div>
          <div className="calendar-grid">
            {cells.map((day, i) => {
              if (day === null) return <span key={`e-${i}`} className="calendar-cell calendar-cell--empty" />
              const iso = `${viewYear}-${pad2(viewMonth + 1)}-${pad2(day)}`
              const disabled = (min && iso < min) || (max && iso > max)
              const selected = value === iso
              const isToday = iso === today
              return (
                <button
                  key={iso}
                  type="button"
                  className={`calendar-cell calendar-day${selected ? ' calendar-day--selected' : ''}${isToday ? ' calendar-day--today' : ''}`}
                  disabled={!!disabled}
                  onClick={() => pick(day)}
                >
                  {day}
                </button>
              )
            })}
          </div>
          {showToday && (
            <button
              type="button"
              className="btn btn-ghost btn-sm calendar-today-btn"
              onClick={() => {
                if (min && today < min) return
                if (max && today > max) return
                onChange(today)
                setOpen(false)
              }}
            >
              Today
            </button>
          )}
        </div>
      )}
    </div>
  )
}
