import { ValidationError } from './errors'

export function optionalCoords(body: Record<string, unknown>): [number | null, number | null] {
  if (body.latitude == null || body.longitude == null) return [null, null]
  const lat = Number(body.latitude)
  const lng = Number(body.longitude)
  if (lat < -90 || lat > 90 || lng < -180 || lng > 180) throw new ValidationError('Invalid coordinates')
  return [lat, lng]
}

export function optionalAccuracy(body: Record<string, unknown>): number | null {
  const raw = body.accuracy_m ?? body.accuracy
  if (raw == null || raw === '') return null
  const accuracy = Number(raw)
  if (accuracy <= 0 || accuracy > 500) return null
  return accuracy
}
