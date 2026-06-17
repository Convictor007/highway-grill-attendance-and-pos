import { useEffect, useMemo, useState } from 'react'
import { api } from '../lib/api'
import type { Role } from '../types/hrms'

export interface PermissionRow {
  permission_id: number
  permission_key: string
  permission_name: string
  module: string
  description?: string | null
}

type RolePermissionsResponse = {
  role: Role & { description?: string | null; is_system?: number | boolean }
  permissions: PermissionRow[]
  all_permissions?: PermissionRow[]
}

type Props = {
  role: Role | null
  /** Controlled selected permission ids (optional). */
  value?: Set<number>
  onChange?: (ids: Set<number>) => void
  compact?: boolean
}

export function RolePermissionsEditor({ role, value, onChange, compact = false }: Props) {
  const [data, setData] = useState<RolePermissionsResponse | null>(null)
  const [internal, setInternal] = useState<Set<number>>(new Set())
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const selected = value ?? internal
  const setSelected = onChange ?? setInternal

  const isSystem = data?.role?.role_type === 'system'

  useEffect(() => {
    if (!role) {
      setData(null)
      if (!onChange) setInternal(new Set())
      setError(null)
      return
    }

    setLoading(true)
    setError(null)
    api<RolePermissionsResponse>(`/roles/${role.role_slug}/permissions`)
      .then((res) => {
        setData(res)
        const ids = new Set(res.permissions.map((p) => p.permission_id))
        if (onChange) {
          if (!value || value.size === 0) onChange(ids)
        } else {
          setInternal(ids)
        }
      })
      .catch((err) => {
        setData(null)
        setError(err instanceof Error ? err.message : 'Could not load permissions')
      })
      .finally(() => setLoading(false))
  }, [role?.role_slug])

  const grouped = useMemo(() => {
    const perms = data?.all_permissions ?? data?.permissions ?? []
    if (!perms.length) return []
    const map = new Map<string, PermissionRow[]>()
    for (const p of perms) {
      const list = map.get(p.module) ?? []
      list.push(p)
      map.set(p.module, list)
    }
    return [...map.entries()].sort(([a], [b]) => a.localeCompare(b))
  }, [data])

  const toggle = (id: number) => {
    const next = new Set(selected)
    if (next.has(id)) next.delete(id)
    else next.add(id)
    setSelected(next)
  }

  if (!role) {
    return <p className="muted-block">Select a role to view permissions.</p>
  }

  if (loading) return <p className="muted-block">Loading permissions…</p>
  if (error) return <p className="error-msg">{error}</p>
  if (!data) return null

  return (
    <div className={`role-permissions-editor${compact ? ' role-permissions-editor--compact' : ''}`}>
      {data.role.description && (
        <p className="role-permissions-desc">{data.role.description}</p>
      )}
      {isSystem && (
        <p className="muted-block staff-perm-system-note">
          System roles are read-only. Change the user&apos;s role to adjust access.
        </p>
      )}
      <p className="role-permissions-count">
        {selected.size} of {(data.all_permissions ?? data.permissions).length} permissions enabled
      </p>
      {grouped.length === 0 ? (
        <p className="muted-block">No permissions available.</p>
      ) : (
        <div className="role-permissions-groups">
          {grouped.map(([module, perms]) => (
            <section key={module} className="role-permissions-group">
              <h3 className="section-title">{module}</h3>
              <ul className="role-permissions-list role-permissions-list--edit">
                {perms.map((p) => (
                  <li key={p.permission_id}>
                    <label className="role-perm-check">
                      <input
                        type="checkbox"
                        checked={selected.has(p.permission_id)}
                        disabled={isSystem}
                        onChange={() => toggle(p.permission_id)}
                      />
                      <span>
                        <strong>{p.permission_name}</strong>
                        <code className="permission-key">{p.permission_key}</code>
                        {p.description && <span className="permission-desc">{p.description}</span>}
                      </span>
                    </label>
                  </li>
                ))}
              </ul>
            </section>
          ))}
        </div>
      )}
    </div>
  )
}

export async function saveRolePermissions(roleSlug: string, permissionIds: number[]) {
  await api(`/roles/${roleSlug}/permissions`, {
    method: 'PUT',
    body: JSON.stringify({ permission_ids: permissionIds }),
  })
}
