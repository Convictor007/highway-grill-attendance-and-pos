import { useEffect, useRef, useState } from 'react'
import { usePopoverPosition } from '../hooks/usePopoverPosition'
import { formatTimeDisplay, normalizeTimeInput, pad2 } from '../lib/datetime'

type Props = {
  label?: string
  value: string
  onChange: (value: string) => void
  id?: string
  required?: boolean
  /** @deprecated minute slots removed — analog clock is used */
  stepMinutes?: number
}

type Mode = 'hours' | 'minutes'
type Meridiem = 'AM' | 'PM'

const CLOCK_SIZE = 232
const CENTER = CLOCK_SIZE / 2
const NUMBER_RADIUS = 92

function parse12(value: string): { hour12: number; minute: number; meridiem: Meridiem } {
  const [hStr, mStr] = normalizeTimeInput(value).split(':')
  const h24 = Math.min(23, Math.max(0, Number(hStr) || 0))
  const minute = Math.min(59, Math.max(0, Number(mStr) || 0))
  const meridiem: Meridiem = h24 >= 12 ? 'PM' : 'AM'
  const hour12 = h24 % 12 === 0 ? 12 : h24 % 12
  return { hour12, minute, meridiem }
}

function to24(hour12: number, meridiem: Meridiem): number {
  if (meridiem === 'AM') return hour12 === 12 ? 0 : hour12
  return hour12 === 12 ? 12 : hour12 + 12
}

/** Pointer/label angle (degrees, 0 = 12 o'clock, clockwise) → x/y on the clock face. */
function polar(angleDeg: number, radius: number): { x: number; y: number } {
  const rad = (angleDeg * Math.PI) / 180
  return {
    x: CENTER + radius * Math.sin(rad),
    y: CENTER - radius * Math.cos(rad),
  }
}

export function TimePicker({ label, value, onChange, id, required }: Props) {
  const [open, setOpen] = useState(false)
  const [mode, setMode] = useState<Mode>('hours')
  const wrapRef = useRef<HTMLDivElement>(null)
  const triggerRef = useRef<HTMLButtonElement>(null)
  const popoverRef = useRef<HTMLDivElement>(null)
  const faceRef = useRef<HTMLDivElement>(null)
  const draggingRef = useRef(false)
  const popoverPos = usePopoverPosition(open, triggerRef, popoverRef)

  const { hour12, minute, meridiem } = parse12(value)

  useEffect(() => {
    if (!open) return
    const onDoc = (e: MouseEvent) => {
      if (wrapRef.current && !wrapRef.current.contains(e.target as Node)) setOpen(false)
    }
    document.addEventListener('mousedown', onDoc)
    return () => document.removeEventListener('mousedown', onDoc)
  }, [open])

  useEffect(() => {
    if (open) setMode('hours')
  }, [open])

  const emit = (h12: number, m: number, mer: Meridiem) => {
    const h24 = to24(h12, mer)
    onChange(`${pad2(h24)}:${pad2(m)}`)
  }

  const setHour = (h12: number) => emit(h12, minute, meridiem)
  const setMinute = (m: number) => emit(hour12, m, meridiem)
  const setMeridiem = (mer: Meridiem) => emit(hour12, minute, mer)

  const valueFromPoint = (clientX: number, clientY: number) => {
    const face = faceRef.current
    if (!face) return
    const rect = face.getBoundingClientRect()
    const dx = clientX - (rect.left + rect.width / 2)
    const dy = clientY - (rect.top + rect.height / 2)
    let angle = (Math.atan2(dx, -dy) * 180) / Math.PI
    if (angle < 0) angle += 360
    if (mode === 'hours') {
      let h = Math.round(angle / 30)
      if (h === 0 || h > 12) h = h === 0 ? 12 : h % 12 || 12
      setHour(h)
    } else {
      const m = Math.round(angle / 6) % 60
      setMinute(m)
    }
  }

  const handlePointerDown = (e: React.PointerEvent) => {
    draggingRef.current = true
    ;(e.target as Element).setPointerCapture?.(e.pointerId)
    valueFromPoint(e.clientX, e.clientY)
  }
  const handlePointerMove = (e: React.PointerEvent) => {
    if (!draggingRef.current) return
    valueFromPoint(e.clientX, e.clientY)
  }
  const handlePointerUp = () => {
    if (!draggingRef.current) return
    draggingRef.current = false
    if (mode === 'hours') setMode('minutes')
  }

  const handAngle = mode === 'hours' ? (hour12 % 12) * 30 : minute * 6
  const handEnd = polar(handAngle, NUMBER_RADIUS)

  const numbers = mode === 'hours'
    ? Array.from({ length: 12 }, (_, i) => i + 1)
    : Array.from({ length: 12 }, (_, i) => i * 5)

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
        <span>{formatTimeDisplay(value)}</span>
        <svg className="picker-trigger-icon" viewBox="0 0 24 24" width="16" height="16" aria-hidden>
          <path d="M12 8v4l3 2M12 22a10 10 0 100-20 10 10 0 000 20z" stroke="currentColor" strokeWidth="2" fill="none" />
        </svg>
      </button>
      {required && !value && <input tabIndex={-1} className="picker-required-proxy" required value="" readOnly />}
      {open && (
        <div
          ref={popoverRef}
          className="picker-popover picker-popover--fixed clock-popover"
          role="dialog"
          style={{
            top: popoverPos?.top ?? 0,
            left: popoverPos?.left ?? 0,
            visibility: popoverPos ? 'visible' : 'hidden',
          }}
        >
          <div className="clock-digital">
            <button
              type="button"
              className={`clock-digital-seg${mode === 'hours' ? ' clock-digital-seg--active' : ''}`}
              onClick={() => setMode('hours')}
            >
              {pad2(hour12)}
            </button>
            <span className="clock-digital-colon">:</span>
            <button
              type="button"
              className={`clock-digital-seg${mode === 'minutes' ? ' clock-digital-seg--active' : ''}`}
              onClick={() => setMode('minutes')}
            >
              {pad2(minute)}
            </button>
            <div className="clock-ampm">
              <button
                type="button"
                className={`clock-ampm-btn${meridiem === 'AM' ? ' clock-ampm-btn--active' : ''}`}
                onClick={() => setMeridiem('AM')}
              >
                AM
              </button>
              <button
                type="button"
                className={`clock-ampm-btn${meridiem === 'PM' ? ' clock-ampm-btn--active' : ''}`}
                onClick={() => setMeridiem('PM')}
              >
                PM
              </button>
            </div>
          </div>

          <div
            ref={faceRef}
            className="clock-face"
            style={{ width: CLOCK_SIZE, height: CLOCK_SIZE }}
            onPointerDown={handlePointerDown}
            onPointerMove={handlePointerMove}
            onPointerUp={handlePointerUp}
          >
            <svg className="clock-hand-svg" viewBox={`0 0 ${CLOCK_SIZE} ${CLOCK_SIZE}`} aria-hidden>
              <line x1={CENTER} y1={CENTER} x2={handEnd.x} y2={handEnd.y} className="clock-hand-line" />
              <circle cx={CENTER} cy={CENTER} r={4} className="clock-hand-center" />
              <circle cx={handEnd.x} cy={handEnd.y} r={18} className="clock-hand-knob" />
            </svg>
            {numbers.map((n, i) => {
              const angle = (mode === 'hours' ? n % 12 : i) * 30
              const { x, y } = polar(angle, NUMBER_RADIUS)
              const active = mode === 'hours' ? n === hour12 : n === minute
              return (
                <span
                  key={n}
                  className={`clock-number${active ? ' clock-number--active' : ''}`}
                  style={{ left: x, top: y }}
                >
                  {mode === 'minutes' ? pad2(n) : n}
                </span>
              )
            })}
          </div>

          <button type="button" className="btn btn-primary btn-sm clock-done-btn" onClick={() => setOpen(false)}>
            Done
          </button>
        </div>
      )}
    </div>
  )
}
