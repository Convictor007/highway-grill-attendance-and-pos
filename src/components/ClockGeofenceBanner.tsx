type Props = {
  required: boolean
  loading?: boolean
  inside: boolean | null
  siteName: string | null
  locationDenied: boolean
}

export function ClockGeofenceBanner({ required, loading, inside, siteName, locationDenied }: Props) {
  if (!required) return null

  const className =
    loading || inside === null
      ? 'geofence-status-banner'
      : inside
        ? 'geofence-status-banner geofence-status-banner--ok'
        : 'geofence-status-banner geofence-status-banner--warn'

  return (
    <div className={className} role="status" style={{ marginTop: '0.5rem' }}>
      {loading || inside === null ? (
        <>Checking your location against work zones…</>
      ) : locationDenied ? (
        <>Allow location access to clock in at your branch.</>
      ) : inside ? (
        <>
          Inside work zone: <strong>{siteName ?? 'Registered area'}</strong>
        </>
      ) : (
        <>Outside work zone — move inside the registered area to clock in.</>
      )}
    </div>
  )
}
