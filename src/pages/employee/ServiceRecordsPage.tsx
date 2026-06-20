import { useEffect, useState } from 'react'
import { api } from '../../lib/api'
import { useAuth } from '../../context/AuthContext'
import { PageHeader } from '../../components/PageHeader'
import { LoadingBlock } from '../../components/LoadingBlock'
import { EmptyState } from '../../components/EmptyState'

interface HrDocument {
  id: string
  category: string
  title: string
  file_url: string | null
  expires_at?: string | null
  created_at: string
}

interface Contract {
  id: string
  contract_type: string
  start_date: string
  end_date: string | null
  hourly_rate: string | null
  weekly_hours: string | null
}

interface BankAccount {
  id: string
  bank_name: string
  account_name: string
  account_no: string
  is_primary: number | boolean
}

interface ServiceRecord {
  employee: { first_name: string; last_name: string; hire_date: string; position_title?: string }
  contracts: Contract[]
  bank_accounts: BankAccount[]
}

const categoryLabels: Record<string, string> = {
  contract: 'Contract',
  id: 'ID',
  certificate: 'Certificate',
  payslip: 'Payslip',
  memo: 'Memo',
  other: 'Other',
}

export function ServiceRecordsPage() {
  const { user } = useAuth()
  const [docs, setDocs] = useState<HrDocument[]>([])
  const [record, setRecord] = useState<ServiceRecord | null>(null)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    const eid = user?.employee_id
    if (!eid) {
      setLoading(false)
      return
    }
    Promise.all([
      api<HrDocument[]>('/documents').catch(() => [] as HrDocument[]),
      api<ServiceRecord>(`/contracts/service-record/${eid}`).catch(() => null),
    ])
      .then(([allDocs, svc]) => {
        setDocs(allDocs)
        setRecord(svc)
      })
      .finally(() => setLoading(false))
  }, [user?.employee_id])

  return (
    <div>
      <PageHeader title="Service Records" subtitle="Contracts, bank details, certificates, and memos" />
      {loading && <LoadingBlock />}

      {!loading && record && (
        <div className="card" style={{ marginBottom: '1rem' }}>
          <h3 className="section-title">Employment</h3>
          <p>
            <strong>
              {record.employee.first_name} {record.employee.last_name}
            </strong>
            {record.employee.position_title && <> · {record.employee.position_title}</>}
          </p>
          <p className="muted-block">Hired {record.employee.hire_date}</p>

          {record.contracts.length > 0 && (
            <>
              <h4 style={{ marginTop: '1rem' }}>Contracts</h4>
              <ul className="doc-list">
                {record.contracts.map((c) => (
                  <li key={c.id} className="doc-row">
                    <div>
                      <strong>{c.contract_type}</strong>
                      <span className="doc-meta">
                        {c.start_date}
                        {c.end_date ? ` – ${c.end_date}` : ' – ongoing'}
                        {c.hourly_rate && ` · ₱${c.hourly_rate}/hr`}
                      </span>
                    </div>
                  </li>
                ))}
              </ul>
            </>
          )}

          {record.bank_accounts.length > 0 && (
            <>
              <h4 style={{ marginTop: '1rem' }}>Bank accounts</h4>
              <ul className="doc-list">
                {record.bank_accounts.map((b) => (
                  <li key={b.id} className="doc-row">
                    <div>
                      <strong>{b.bank_name}</strong>
                      <span className="doc-meta">
                        {b.account_name} · {b.account_no}
                        {b.is_primary ? ' · Primary' : ''}
                      </span>
                    </div>
                  </li>
                ))}
              </ul>
            </>
          )}
        </div>
      )}

      <div className="card">
        <h3 className="section-title">Documents</h3>
        {!loading && docs.length === 0 ? (
          <EmptyState title="No service records" description="HR will add your contract and certificates here." />
        ) : (
          <ul className="doc-list">
            {docs.map((d) => (
              <li key={d.id} className="doc-row">
                <div>
                  <strong>{d.title}</strong>
                  <span className="doc-meta">
                    {categoryLabels[d.category] ?? d.category} ·{' '}
                    {new Date(d.created_at.replace(' ', 'T')).toLocaleDateString()}
                    {d.expires_at ? ` · Expires ${new Date(d.expires_at.replace(' ', 'T')).toLocaleDateString()}` : ''}
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
