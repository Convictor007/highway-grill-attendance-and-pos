import { useEffect, useState } from 'react'
import { api } from '../../lib/api'
import { PageHeader } from '../../components/PageHeader'
import { LoadingBlock } from '../../components/LoadingBlock'
import { DtrExportForm } from '../../components/DtrExportForm'

type EmployeeRow = {
  id: string
  emp_number: string
  first_name: string
  last_name: string
}

export function DtrExportPage() {
  const [employees, setEmployees] = useState<EmployeeRow[]>([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    api<EmployeeRow[]>('/employees?status=active')
      .then(setEmployees)
      .finally(() => setLoading(false))
  }, [])

  return (
    <div>
      <PageHeader
        title="Export DTR"
        subtitle="Download daily time records as Excel or PDF"
      />

      {loading ? (
        <LoadingBlock />
      ) : employees.length === 0 ? (
        <div className="card">
          <p className="muted-block">No active employees found.</p>
        </div>
      ) : (
        <DtrExportForm employees={employees} />
      )}
    </div>
  )
}
