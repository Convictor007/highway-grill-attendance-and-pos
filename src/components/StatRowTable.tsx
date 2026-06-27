import { Link } from 'react-router-dom'

export type StatRowItem = {
  label: string
  value: string | number | null | undefined
  to?: string
}

type Props = {
  items: StatRowItem[]
  className?: string
}

/**
 * Compact metrics grid. Lays the items out in a single row when they fit,
 * and reflows into multiple rows (2 columns on narrow screens) otherwise.
 */
export function StatRowTable({ items, className }: Props) {
  if (items.length === 0) return null
  return (
    <div className={`stat-row${className ? ` ${className}` : ''}`}>
      {items.map((item) => {
        const display = item.value ?? '—'
        const content = (
          <>
            <span className="stat-row__value">{display}</span>
            <span className="stat-row__label">{item.label}</span>
          </>
        )
        return item.to ? (
          <Link key={item.label} to={item.to} className="stat-row__cell stat-row__cell--link">
            {content}
          </Link>
        ) : (
          <div key={item.label} className="stat-row__cell">
            {content}
          </div>
        )
      })}
    </div>
  )
}
