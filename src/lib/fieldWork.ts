import { api } from './api'

export type ZoneStatus = {
  inside: boolean
  site: {
    id: string
    name: string
    address: string | null
    latitude: string
    longitude: string
    radius_m: number
  } | null
  distance_m: number | null
  nearest_site?: {
    id: string
    name: string
    latitude: string
    longitude: string
    radius_m: number
  } | null
  nearest_distance_m?: number | null
}

export async function fetchZoneStatus(
  latitude: number,
  longitude: number,
  options?: { clockInOnly?: boolean; accuracyM?: number }
): Promise<ZoneStatus> {
  const clockIn = options?.clockInOnly ? '&clock_in_only=1' : ''
  const accuracy =
    options?.accuracyM != null && options.accuracyM > 0
      ? `&accuracy_m=${encodeURIComponent(options.accuracyM)}`
      : ''
  return api<ZoneStatus>(
    `/field-work/zone-status?latitude=${encodeURIComponent(latitude)}&longitude=${encodeURIComponent(longitude)}${clockIn}${accuracy}`
  )
}

export type FieldCheckinResult = {
  id: string
  site_name: string | null
  attendance_id?: string | null
  attendance_action?: 'clocked_in' | 'linked' | null
}
