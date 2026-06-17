import { normalizeTimeInput } from '../lib/datetime'

type Props = {
  label?: string
  value: string
  onChange: (value: string) => void
  id?: string
  /** @deprecated minute slots removed — native clock input is used */
  stepMinutes?: number
}

export function TimePicker({ label, value, onChange, id }: Props) {
  const normalized = normalizeTimeInput(value)

  return (
    <div className="picker-field">
      {label && (
        <label className="picker-label" htmlFor={id}>
          {label}
        </label>
      )}
      <input
        id={id}
        type="time"
        className="time-clock-input"
        value={normalized}
        onChange={(e) => onChange(normalizeTimeInput(e.target.value))}
      />
    </div>
  )
}
