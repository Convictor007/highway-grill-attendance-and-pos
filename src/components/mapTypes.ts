export type MapMarker = {
  id: string
  lat: number
  lng: number
  label: string
  kind?: 'site' | 'checkin' | 'you'
}
