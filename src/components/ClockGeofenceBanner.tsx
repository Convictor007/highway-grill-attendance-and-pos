import { geoErrorMessage, type GeoErrorCode } from '../lib/geolocation'
import type { VicinityStatus } from '../lib/vicinity'

type Props = {
  required: boolean
  mobileClock?: boolean
  positionLabel?: string | null
  sessionActive?: boolean
  loading?: boolean
  inside: boolean | null
  siteName: string | null
  locationDenied: boolean
  locationError?: GeoErrorCode | null
  checkedOnce?: boolean
  nearestSiteName?: string | null
  nearestDistanceM?: number | null
  vicinity?: VicinityStatus | null
  onRequestLocation?: () => void
  requesting?: boolean
}

function formatCountdown(seconds: number): string {
  const mins = Math.floor(seconds / 60)
  const secs = seconds % 60
  if (mins <= 0) return `${secs}s`
  return secs > 0 ? `${mins}m ${secs}s` : `${mins}m`
}

export function ClockGeofenceBanner({
  required,
  mobileClock = false,
  positionLabel = null,
  sessionActive = false,
  loading,
  inside,
  siteName,
  locationDenied,
  locationError,
  checkedOnce = true,
  nearestSiteName,
  nearestDistanceM,
  vicinity,
  onRequestLocation,
  requesting,
}: Props) {
  if (!required) {
    if (!mobileClock) return null
    return (
      <div className="geofence-status-banner geofence-status-banner--ok" role="status" style={{ marginTop: '0.5rem' }}>
        {positionLabel ?? 'Mobile'} staff — clock in and out from any location (GPS optional).
      </div>
    )
  }

  const className =
    loading || inside === null
      ? 'geofence-status-banner'
      : inside
        ? 'geofence-status-banner geofence-status-banner--ok'
        : 'geofence-status-banner geofence-status-banner--warn'

  const showEnableButton = !sessionActive && locationDenied && !!onRequestLocation
  const nearestLabel =
    nearestSiteName && nearestDistanceM != null
      ? `${nearestSiteName} (${Math.round(nearestDistanceM)} m away)`
      : null

  return (
    <div className={className} role="status" style={{ marginTop: '0.5rem' }}>
      {loading ? (
        <>Checking your location…</>
      ) : sessionActive ? (
        inside ? (
          <>Inside branch zone: <strong>{siteName ?? 'Work zone'}</strong></>
        ) : (
          <>
            Outside work zone.
            {nearestLabel && (
              <span className="geofence-status-distance"> Nearest: {nearestLabel}.</span>
            )}
            {vicinity?.auto_outside_eligible && vicinity.seconds_until_auto_out != null ? (
              <>
                {' '}
                Auto clock-out in <strong>{formatCountdown(vicinity.seconds_until_auto_out)}</strong>
                {vicinity.past_midnight ? ' (past midnight).' : '.'}
              </>
            ) : (
              <>
                {' '}
                Auto clock-out applies after midnight if you stay outside for{' '}
                {vicinity?.outside_grace_minutes ?? 5} minutes.
              </>
            )}
          </>
        )
      ) : inside === null && !checkedOnce ? (
        <>All staff must clock in at the branch — tap Enable location to check you are in the work zone.</>
      ) : locationDenied ? (
        <div className="geofence-location-prompt">
          <p className="geofence-location-prompt__text">
            {locationError ? geoErrorMessage(locationError) : 'Allow location access to clock in at your branch.'}
          </p>
          {showEnableButton && (
            <button
              type="button"
              className="btn btn-enable-location btn-sm geofence-location-prompt__btn"
              disabled={requesting || loading}
              onClick={onRequestLocation}
            >
              {requesting || loading ? 'Checking…' : 'Enable location'}
            </button>
          )}
        </div>
      ) : inside ? (
        <>
          Inside branch zone: <strong>{siteName ?? 'Work zone'}</strong>
        </>
      ) : (
        <>
          Outside work zone — move inside the check-in area to clock in.
          {nearestLabel && (
            <span className="geofence-status-distance"> Nearest: {nearestLabel}</span>
          )}
          <span className="geofence-status-distance"> GPS tolerance is applied to the zone radius.</span>
        </>
      )}
    </div>
  )
}
