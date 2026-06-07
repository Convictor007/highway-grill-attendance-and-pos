export type VicinityStatus = {
  inside: boolean
  geofence_active?: boolean
  outside_since?: string | null
  outside_grace_minutes?: number
  seconds_until_auto_out?: number | null
  auto_outside_eligible?: boolean
  past_midnight?: boolean
}

export type VicinityPingResult = {
  auto_clocked_out: boolean
  session: unknown
  vicinity?: VicinityStatus
}
