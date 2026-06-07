import { emptyParts, type AddressParts } from '../lib/geocode'

function splitAddressLines(address: string): AddressParts {
  if (!address.trim()) return emptyParts()
  const segments = address.split(',').map((s) => s.trim()).filter(Boolean)
  if (segments.length <= 1) {
    return { region_line: '', postal_code: '', street_line: address.trim() }
  }
  const last = segments[segments.length - 1]
  const postal = /^\d{4,6}$/.test(last) ? last : ''
  const withoutPostal = postal ? segments.slice(0, -1) : segments
  const street = withoutPostal[0] ?? ''
  const region = withoutPostal.slice(1).join(', ')
  return {
    street_line: street,
    region_line: region,
    postal_code: postal,
  }
}

type Props = {
  value: string
  onChange?: (value: string) => void
  disabled?: boolean
}

export function ProfileAddressCard({ value, onChange, disabled }: Props) {
  const parts = splitAddressLines(value)
  const editable = !disabled && !!onChange

  return (
    <section className="profile-section-card card">
      <header className="profile-section-card__head">
        <span className="profile-section-card__icon profile-section-card__icon--location" aria-hidden>
          <svg viewBox="0 0 24 24" width="18" height="18" fill="currentColor">
            <path d="M12 2C8.13 2 5 5.13 5 9c0 5.25 7 13 7 13s7-7.75 7-13c0-3.87-3.13-7-7-7zm0 9.5A2.5 2.5 0 1 1 12 6a2.5 2.5 0 0 1 0 5.5z" />
          </svg>
        </span>
        <h3 className="profile-section-card__title">Address Information</h3>
      </header>

      <div className="profile-address-card__body">
        {editable ? (
          <div className="form-group profile-form-group">
            <label htmlFor="profile-address">Full address</label>
            <textarea
              id="profile-address"
              className="address-field__textarea"
              rows={4}
              value={value}
              placeholder="Street, barangay, city/municipality, province, postal code"
              onChange={(e) => onChange!(e.target.value)}
            />
            <p className="profile-address-card__hint muted-block">
              Enter your complete address manually (comma-separated is fine).
            </p>
          </div>
        ) : (
          <div className="profile-address-card__box">
            <div className="profile-address-card__box-head">
              <span className="profile-address-card__box-label">Region, Province, City, Barangay</span>
            </div>
            {value ? (
              <dl className="profile-address-card__details">
                {parts.region_line && (
                  <div className="profile-address-card__detail">
                    <dt>Area</dt>
                    <dd>{parts.region_line}</dd>
                  </div>
                )}
                {parts.postal_code && (
                  <div className="profile-address-card__detail">
                    <dt>Postal code</dt>
                    <dd>{parts.postal_code}</dd>
                  </div>
                )}
                <div className="profile-address-card__detail">
                  <dt>Street</dt>
                  <dd>{parts.street_line || value}</dd>
                </div>
              </dl>
            ) : (
              <p className="profile-address-card__empty">—</p>
            )}
          </div>
        )}
      </div>
    </section>
  )
}
