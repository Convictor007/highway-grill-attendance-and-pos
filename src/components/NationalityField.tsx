import { useEffect, useState } from 'react'

export const DEFAULT_NATIONALITY = 'Filipino'

const OTHER_COUNTRIES = [
  'American', 'Australian', 'British', 'Canadian', 'Chinese', 'Indian',
  'Indonesian', 'Japanese', 'Korean', 'Malaysian', 'Singaporean', 'Vietnamese',
]

type Props = {
  value: string
  onChange: (value: string) => void
  disabled?: boolean
  label?: string
}

export function NationalityField({ value, onChange, disabled, label = 'Nationality' }: Props) {
  const isFilipino = !value || value === DEFAULT_NATIONALITY
  const [mode, setMode] = useState<'filipino' | 'other'>(isFilipino ? 'filipino' : 'other')
  const [other, setOther] = useState(isFilipino ? '' : value)

  useEffect(() => {
    const fil = !value || value === DEFAULT_NATIONALITY
    setMode(fil ? 'filipino' : 'other')
    setOther(fil ? '' : value)
  }, [value])

  return (
    <div className="form-group nationality-field">
      <label>{label}</label>
      <div className="nationality-field__group" role="group" aria-label="Nationality">
        <button
          type="button"
          className={`nationality-field__option${mode === 'filipino' ? ' nationality-field__option--active' : ''}`}
          disabled={disabled}
          onClick={() => {
            setMode('filipino')
            onChange(DEFAULT_NATIONALITY)
          }}
        >
          Filipino
        </button>
        <button
          type="button"
          className={`nationality-field__option${mode === 'other' ? ' nationality-field__option--active' : ''}`}
          disabled={disabled}
          onClick={() => {
            setMode('other')
            onChange(other.trim() || '')
          }}
        >
          Other
        </button>
      </div>
      {mode === 'other' && (
        <input
          className="nationality-field__other"
          list="nationality-suggestions"
          value={other}
          disabled={disabled}
          placeholder="Specify nationality"
          onChange={(e) => {
            setOther(e.target.value)
            onChange(e.target.value)
          }}
        />
      )}
      <datalist id="nationality-suggestions">
        {OTHER_COUNTRIES.map((c) => (
          <option key={c} value={c} />
        ))}
      </datalist>
    </div>
  )
}
