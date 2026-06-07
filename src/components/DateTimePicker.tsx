import { joinDateTime, splitDateTime } from '../lib/datetime'
import { DatePicker } from './DatePicker'
import { TimePicker } from './TimePicker'

type Props = {
  label?: string
  value: string
  onChange: (value: string) => void
  required?: boolean
  minDate?: string
  maxDate?: string
  timeStep?: number
}

export function DateTimePicker({
  label,
  value,
  onChange,
  required,
  minDate,
  maxDate,
  timeStep = 15,
}: Props) {
  const { date, time } = splitDateTime(value)

  return (
    <div className="datetime-picker">
      {label && <span className="picker-label">{label}</span>}
      <div className="datetime-picker-row">
        <DatePicker
          value={date}
          onChange={(d) => onChange(joinDateTime(d, time || '09:00'))}
          required={required}
          min={minDate}
          max={maxDate}
        />
        <TimePicker value={time || '09:00'} onChange={(t) => onChange(joinDateTime(date, t))} stepMinutes={timeStep} />
      </div>
    </div>
  )
}
