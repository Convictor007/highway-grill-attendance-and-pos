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

/** Compact single-row metrics table (replaces the stat-card grid). */
export function StatRowTable({ items, className }: Props) {
  if (items.length === 0) return null
  return (
    <div className={`card table-wrap stat-table-wrap${className ? ` ${className}` : ''}`}>
      <table className="stat-table">
        <thead>
          <tr>
            {items.map((item) => (
              <th key={item.label}>{item.label}</th>
            ))}
          </tr>
        </thead>
        <tbody>
          <tr>
            {items.map((item) => {
              const display = item.value ?? '—'
              return (
                <td key={item.label}>
                  {item.to ? (
                    <Link to={item.to} className="stat-table__value stat-table__value--link">
                      {display}
                    </Link>
                  ) : (
                    <span className="stat-table__value">{display}</span>
                  )}
                </td>
              )
            })}
          </tr>
        </tbody>
      </table>
    </div>
  )
}
