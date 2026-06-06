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
  file_type: string | null
  expires_at: string | null
  created_at: string
}

const categoryLabels: Record<string, string> = {
  contract: 'Contract',
  id: 'ID',
  certificate: 'Certificate',
  payslip: 'Payslip',
  memo: 'Memo',
  other: 'Other',
}

export function MyDocumentsPage() {
  const [rows, setRows] = useState<HrDocument[]>([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    api<HrDocument[]>('/documents')
      .then(setRows)
      .catch(() => setRows([]))
      .finally(() => setLoading(false))
  }, [])

  return (
    <div>
      <PageHeader title="My Documents" subtitle="HR files shared with you (non-confidential)" />
      <div className="card">
        {loading ? (
          <LoadingBlock />
        ) : rows.length === 0 ? (
          <EmptyState title="No documents" description="HR will upload contracts and certificates here." />
        ) : (
          <ul className="doc-list">
            {rows.map((d) => (
              <li key={d.id} className="doc-row">
                <div>
                  <strong>{d.title}</strong>
                  <span className="doc-meta">
                    {categoryLabels[d.category] ?? d.category}
                    {' · '}
                    {new Date(d.created_at.replace(' ', 'T')).toLocaleDateString()}
                  </span>
                </div>
                {d.file_url ? (
                  <a href={d.file_url} target="_blank" rel="noopener noreferrer" className="btn btn-ghost btn-sm">
                    Open
                  </a>
                ) : (
                  <span className="muted-inline">On file</span>
                )}
              </li>
            ))}
          </ul>
        )}
      </div>
    </div>
  )
}
