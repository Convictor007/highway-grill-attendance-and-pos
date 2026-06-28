import { useEffect, useRef, useState } from 'react'

const HELP_POINTS = [
  'Clock in inside the work zone.',
  'Regular time counts from your scheduled shift start to your scheduled shift end.',
  'Clocking in early (before your shift start) does not add extra hours.',
  'Overtime is recorded only after your scheduled shift end.',
  'After midnight, leaving the work zone for 5 minutes clocks you out automatically.',
]

export function ClockHelpButton() {
  const [open, setOpen] = useState(false)
  const wrapRef = useRef<HTMLSpanElement>(null)

  useEffect(() => {
    if (!open) return
    const onDown = (e: MouseEvent) => {
      if (wrapRef.current && !wrapRef.current.contains(e.target as Node)) {
        setOpen(false)
      }
    }
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') setOpen(false)
    }
    document.addEventListener('mousedown', onDown)
    document.addEventListener('keydown', onKey)
    return () => {
      document.removeEventListener('mousedown', onDown)
      document.removeEventListener('keydown', onKey)
    }
  }, [open])

  return (
    <span className="clock-help" ref={wrapRef}>
      <button
        type="button"
        className="clock-help__btn"
        aria-label="Time clock rules"
        aria-expanded={open}
        title="Time clock rules"
        onClick={() => setOpen((v) => !v)}
      >
        ?
      </button>
      {open && (
        <div className="clock-help__popover picker-popover" role="dialog" aria-label="Time clock rules">
          <p className="clock-help__title">How the time clock works</p>
          <ul className="clock-help__list">
            {HELP_POINTS.map((point) => (
              <li key={point}>{point}</li>
            ))}
          </ul>
        </div>
      )}
    </span>
  )
}
