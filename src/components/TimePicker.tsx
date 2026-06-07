import { useEffect, useRef, useState } from 'react'
import { usePopoverPosition } from '../hooks/usePopoverPosition'
import { formatTimeDisplay, pad2 } from '../lib/datetime'

type Props = {
  label?: string
  value: string
  onChange: (value: string) => void
  stepMinutes?: number
  id?: string
}

function buildSlots(step: number): string[] {
  const slots: string[] = []
  for (let h = 0; h < 24; h++) {
    for (let m = 0; m < 60; m += step) {
      slots.push(`${pad2(h)}:${pad2(m)}`)
    }
  }
  return slots
}

export function TimePicker({ label, value, onChange, stepMinutes = 15, id }: Props) {
  const [open, setOpen] = useState(false)
  const wrapRef = useRef<HTMLDivElement>(null)
  const triggerRef = useRef<HTMLButtonElement>(null)
  const popoverRef = useRef<HTMLDivElement>(null)
  const popoverPos = usePopoverPosition(open, triggerRef, popoverRef)
  const slots = buildSlots(stepMinutes)
  const listRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    if (!open) return
    const onDoc = (e: MouseEvent) => {
      if (wrapRef.current && !wrapRef.current.contains(e.target as Node)) setOpen(false)
    }
    document.addEventListener('mousedown', onDoc)
    return () => document.removeEventListener('mousedown', onDoc)
  }, [open])

  useEffect(() => {
    if (!open || !value || !listRef.current) return
    const el = listRef.current.querySelector(`[data-time="${value}"]`)
    if (el) el.scrollIntoView({ block: 'center' })
  }, [open, value])

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
      >
        <span className="picker-trigger-icon" aria-hidden>
          🕐
        </span>
        <span>{formatTimeDisplay(value)}</span>
      </button>
      {open && (
        <div
          ref={popoverRef}
          className="picker-popover picker-popover--fixed time-popover"
          role="listbox"
          style={{
            top: popoverPos?.top ?? 0,
            left: popoverPos?.left ?? 0,
            maxWidth: popoverPos?.maxWidth ?? 'calc(100vw - 16px)',
            visibility: popoverPos ? 'visible' : 'hidden',
          }}
        >
          <div className="time-slots" ref={listRef}>
            {slots.map((t) => (
              <button
                key={t}
                type="button"
                role="option"
                data-time={t}
                className={`time-slot${value === t ? ' time-slot--selected' : ''}`}
                onClick={() => {
                  onChange(t)
                  setOpen(false)
                }}
              >
                {formatTimeDisplay(t)}
              </button>
            ))}
          </div>
        </div>
      )}
    </div>
  )
}
