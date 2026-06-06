export type BranchWithMapCenter = {
  id: string
  name: string
  default_latitude?: string | number | null
  default_longitude?: string | number | null
}

export type SiteCoords = {
  branch_id: string | null
  latitude: string | number
  longitude: string | number
}

export function branchMapCenter(
  branchId: string,
  branches: BranchWithMapCenter[],
  sites: SiteCoords[],
  fallback: [number, number]
): [number, number] {
  const branch = branches.find((b) => b.id === branchId)
  if (branch) {
    const lat = Number(branch.default_latitude)
    const lng = Number(branch.default_longitude)
    if (Number.isFinite(lat) && Number.isFinite(lng)) {
      return [lat, lng]
    }
  }

  const forBranch = sites.filter((s) => s.branch_id === branchId)
  if (forBranch.length > 0) {
    const last = forBranch[forBranch.length - 1]
    const lat = Number(last.latitude)
    const lng = Number(last.longitude)
    if (Number.isFinite(lat) && Number.isFinite(lng)) {
      return [lat, lng]
    }
  }

  return fallback
}
