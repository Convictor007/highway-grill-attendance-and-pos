import { useEffect, useState } from 'react'
import { api } from '../../lib/api'
import { PageHeader } from '../../components/PageHeader'
import { LoadingBlock } from '../../components/LoadingBlock'
import { EmptyState } from '../../components/EmptyState'

interface HrDocument {
  id: string
  category: string
  title: string
  file_url: string | null
  created_at: string
}

const SERVICE_CATEGORIES = new Set(['contract', 'certificate', 'memo'])

export function ServiceRecordsPage() {
  const [rows, setRows] = useState<HrDocument[]>([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    api<HrDocument[]>('/documents')
      .then((all) => setRows(all.filter((d) => SERVICE_CATEGORIES.has(d.category))))
      .catch(() => setRows([]))
      .finally(() => setLoading(false))
  }, [])

  return (
    <div>
      <PageHeader title="Service Records" subtitle="Contracts, certificates, and employment memos" />
      <div className="card">
        {loading ? (
          <LoadingBlock />
        ) : rows.length === 0 ? (
          <EmptyState title="No service records" description="HR will add your contract and certificates here." />
        ) : (
          <ul className="doc-list">
            {rows.map((d) => (
              <li key={d.id} className="doc-row">
                <div>
                  <strong>{d.title}</strong>
                  <span className="doc-meta">
                    {d.category} · {new Date(d.created_at.replace(' ', 'T')).toLocaleDateString()}
                  </span>
                </div>
                {d.file_url ? (
                  <a href={d.file_url} target="_blank" rel="noopener noreferrer" className="btn btn-ghost btn-sm">
                    View
                  </a>
                ) : (
                  <span className="muted-inline">Recorded</span>
                )}
              </li>
            ))}
          </ul>
        )}
      </div>
    </div>
  )
}
