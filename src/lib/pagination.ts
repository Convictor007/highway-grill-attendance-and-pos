export type PaginatedResult<T> = {
  items: T[]
  total: number
  page: number
  limit: number
  pages: number
}

export const DEFAULT_PAGE_SIZE = 25

export function pageRange(page: number, pages: number): number[] {
  if (pages <= 1) return [1]
  const start = Math.max(1, page - 2)
  const end = Math.min(pages, start + 4)
  const from = Math.max(1, end - 4)
  const nums: number[] = []
  for (let i = from; i <= end; i++) nums.push(i)
  return nums
}

export function buildQuery(params: Record<string, string | number | undefined | null>): string {
  const q = new URLSearchParams()
  for (const [key, value] of Object.entries(params)) {
    if (value === undefined || value === null || value === '') continue
    q.set(key, String(value))
  }
  const s = q.toString()
  return s ? `?${s}` : ''
}
