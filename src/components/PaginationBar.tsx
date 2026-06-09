import { pageRange } from '../lib/pagination'

type Props = {
  page: number
  pages: number
  total: number
  limit: number
  onPage: (page: number) => void
  disabled?: boolean
}

export function PaginationBar({ page, pages, total, limit, onPage, disabled }: Props) {
  if (total === 0) return null

  const from = (page - 1) * limit + 1
  const to = Math.min(page * limit, total)

  return (
    <div className="pagination-bar">
      <span className="pagination-bar__meta">
        {from}–{to} of {total.toLocaleString()}
      </span>
      <div className="pagination-bar__controls">
        <button
          type="button"
          className="btn btn-ghost btn-sm"
          disabled={disabled || page <= 1}
          onClick={() => onPage(page - 1)}
        >
          Prev
        </button>
        {pageRange(page, pages).map((n) => (
          <button
            key={n}
            type="button"
            className={`btn btn-ghost btn-sm${n === page ? ' pagination-bar__page--active' : ''}`}
            disabled={disabled}
            onClick={() => onPage(n)}
          >
            {n}
          </button>
        ))}
        <button
          type="button"
          className="btn btn-ghost btn-sm"
          disabled={disabled || page >= pages}
          onClick={() => onPage(page + 1)}
        >
          Next
        </button>
      </div>
    </div>
  )
}
