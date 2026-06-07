type Props = {
  value: string
  onChange: (value: string) => void
  disabled?: boolean
  label?: string
  hint?: string
  /** Shorter layout for dense forms (register, HR employee modal). */
  compact?: boolean
}

export function AddressField({
  value,
  onChange,
  disabled,
  label = 'Address',
  hint,
  compact = false,
}: Props) {
  const hintText = hint ?? (compact ? undefined : 'Enter street, barangay, city, province, and postal code.')

  return (
    <div className="address-field">
      <label className="address-field__label">{label}</label>
      {hintText && <p className="address-field__hint">{hintText}</p>}

      <textarea
        className="address-field__textarea"
        rows={compact ? 2 : 3}
        value={value}
        disabled={disabled}
        placeholder="Street, barangay, city, province"
        onChange={(e) => onChange(e.target.value)}
      />
    </div>
  )
}
