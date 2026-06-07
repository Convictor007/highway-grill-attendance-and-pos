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
  /** Month + year dropdowns — best for birthdays and dates far from today */
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

export function DatePicker({ label, value, onChange, required, min, max, id, birthDate }: Props) {
  const [open, setOpen] = useState(false)
  const wrapRef = useRef<HTMLDivElement>(null)
  const triggerRef = useRef<HTMLButtonElement>(null)
  const popoverRef = useRef<HTMLDivElement>(null)
  const popoverPos = usePopoverPosition(open, triggerRef, popoverRef)
  const base = value ? new Date(value + 'T12:00:00') : new Date()
  const [viewYear, setViewYear] = useState(base.getFullYear())
  const [viewMonth, setViewMonth] = useState(base.getMonth())

  const maxYear = parseYear(max, new Date().getFullYear())
  const minYear = parseYear(min, maxYear - 100)

  const yearOptions = useMemo(() => {
    const years: number[] = []
    for (let y = maxYear; y >= minYear; y--) years.push(y)
    return years
  }, [maxYear, minYear])

  useEffect(() => {
    if (!value) return
    const d = new Date(value + 'T12:00:00')
    if (!Number.isNaN(d.getTime())) {
      setViewYear(d.getFullYear())
      setViewMonth(d.getMonth())
    }
  }, [value])

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

  const prevMonth = () => {
    if (viewMonth === 0) {
      setViewMonth(11)
      setViewYear((y) => Math.max(minYear, y - 1))
    } else setViewMonth((m) => m - 1)
  }

  const nextMonth = () => {
    if (viewMonth === 11) {
      setViewMonth(0)
      setViewYear((y) => Math.min(maxYear, y + 1))
    } else setViewMonth((m) => m + 1)
  }

  const monthLabel = new Date(viewYear, viewMonth, 1).toLocaleDateString(undefined, {
    month: 'long',
    year: 'numeric',
  })

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
          className={`picker-popover picker-popover--fixed calendar-popover${birthDate ? ' calendar-popover--birth' : ''}`}
          role="dialog"
          style={{
            top: popoverPos?.top ?? 0,
            left: popoverPos?.left ?? 0,
            maxWidth: popoverPos?.maxWidth ?? 'calc(100vw - 16px)',
            visibility: popoverPos ? 'visible' : 'hidden',
          }}
        >
          {birthDate ? (
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
          ) : (
            <div className="calendar-head">
              <button type="button" className="btn btn-ghost btn-sm" onClick={prevMonth} aria-label="Previous month">
                ‹
              </button>
              <strong>{monthLabel}</strong>
              <button type="button" className="btn btn-ghost btn-sm" onClick={nextMonth} aria-label="Next month">
                ›
              </button>
            </div>
          )}
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
              const today = iso === todayLocalIsoDate()
              return (
                <button
                  key={iso}
                  type="button"
                  className={`calendar-cell calendar-day${selected ? ' calendar-day--selected' : ''}${today ? ' calendar-day--today' : ''}`}
                  disabled={!!disabled}
                  onClick={() => pick(day)}
                >
                  {day}
                </button>
              )
            })}
          </div>
          {!birthDate && (
            <button
              type="button"
              className="btn btn-ghost btn-sm calendar-today-btn"
              onClick={() => {
                onChange(todayLocalIsoDate())
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
