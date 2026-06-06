export const MIN_ZONE_RADIUS_M = 50
export const MAX_ZONE_RADIUS_M = 800
export const DEFAULT_ZONE_RADIUS_M = MIN_ZONE_RADIUS_M
export const ZONE_RADIUS_STEP_M = 25

type Props = {
  radiusM: number
  onChange: (radiusM: number) => void
}

export function GeofenceAreaControl({ radiusM, onChange }: Props) {
  return (
    <div className="geofence-area-control" role="group" aria-label="Check-in area size">
      <div className="geofence-area-control-header">
        <span className="geofence-area-control-title">Check-in area</span>
        <span className="geofence-area-control-value">
          {radiusM}
          <span className="geofence-area-control-unit">m</span>
        </span>
      </div>
      <input
        type="range"
        className="geofence-area-control-slider"
        min={MIN_ZONE_RADIUS_M}
        max={MAX_ZONE_RADIUS_M}
        step={ZONE_RADIUS_STEP_M}
        value={radiusM}
        onChange={(e) => onChange(Number(e.target.value))}
        aria-valuemin={MIN_ZONE_RADIUS_M}
        aria-valuemax={MAX_ZONE_RADIUS_M}
        aria-valuenow={radiusM}
        aria-label="Radius in meters"
      />
      <div className="geofence-area-control-scale">
        <span>{MIN_ZONE_RADIUS_M} m</span>
        <span>{MAX_ZONE_RADIUS_M} m</span>
      </div>
    </div>
  )
}
