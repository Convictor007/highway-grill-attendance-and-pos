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
}

export async function fetchZoneStatus(latitude: number, longitude: number): Promise<ZoneStatus> {
  return api<ZoneStatus>(
    `/field-work/zone-status?latitude=${encodeURIComponent(latitude)}&longitude=${encodeURIComponent(longitude)}`
  )
}

export type FieldCheckinResult = {
  id: string
  site_name: string | null
  attendance_id?: string | null
  attendance_action?: 'clocked_in' | 'linked' | null
}
