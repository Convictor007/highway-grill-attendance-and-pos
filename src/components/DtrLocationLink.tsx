type Props = {
  latitude?: string | number | null
  longitude?: string | number | null
  address?: string | null
}

export function DtrLocationLink({ latitude, longitude, address }: Props) {
  if (address) {
    return <span className="dtr-address" title={address}>{address}</span>
  }

  if (latitude == null || longitude == null || latitude === '' || longitude === '') {
    return <span className="muted-inline">—</span>
  }

  const lat = Number(latitude)
  const lng = Number(longitude)
  if (!Number.isFinite(lat) || !Number.isFinite(lng)) {
    return <span className="muted-inline">—</span>
  }

  const url = `https://www.openstreetmap.org/?mlat=${lat}&mlon=${lng}#map=17/${lat}/${lng}`
  return (
    <a href={url} target="_blank" rel="noopener noreferrer" className="text-link dtr-loc-link">
      Map
    </a>
  )
}
