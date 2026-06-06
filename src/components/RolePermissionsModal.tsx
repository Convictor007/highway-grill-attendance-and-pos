import { useEffect, useMemo, useState } from 'react'

import { api } from '../lib/api'

import { Modal } from './Modal'

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

  open: boolean

  role: Role | null

  onClose: () => void

  onSaved?: () => void

}



export function RolePermissionsModal({ open, role, onClose, onSaved }: Props) {

  const [data, setData] = useState<RolePermissionsResponse | null>(null)

  const [selected, setSelected] = useState<Set<number>>(new Set())

  const [loading, setLoading] = useState(false)

  const [saving, setSaving] = useState(false)

  const [error, setError] = useState<string | null>(null)



  const isSystem = data?.role?.role_type === 'system'



  useEffect(() => {

    if (!open || !role) {

      setData(null)

      setSelected(new Set())

      setError(null)

      return

    }



    setLoading(true)

    setError(null)

    api<RolePermissionsResponse>(`/roles/${role.role_slug}/permissions`)

      .then((res) => {

        setData(res)

        setSelected(new Set(res.permissions.map((p) => p.permission_id)))

      })

      .catch((err) => {

        setData(null)

        setError(err instanceof Error ? err.message : 'Could not load permissions')

      })

      .finally(() => setLoading(false))

  }, [open, role])



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

    setSelected((prev) => {

      const next = new Set(prev)

      if (next.has(id)) next.delete(id)

      else next.add(id)

      return next

    })

  }



  const save = async () => {

    if (!role || isSystem) return

    setSaving(true)

    setError(null)

    try {

      await api(`/roles/${role.role_slug}/permissions`, {

        method: 'PUT',

        body: JSON.stringify({ permission_ids: [...selected] }),

      })

      onSaved?.()

      onClose()

    } catch (err) {

      setError(err instanceof Error ? err.message : 'Could not save permissions')

    } finally {

      setSaving(false)

    }

  }



  return (

    <Modal

      open={open}

      title={role ? `Permissions — ${role.role_name}` : 'Role permissions'}

      onClose={onClose}

      size="wide"

      footer={

        <>

          <button type="button" className="btn btn-ghost" onClick={onClose} disabled={saving}>

            Cancel

          </button>

          {!isSystem && (

            <button type="button" className="btn btn-primary" onClick={save} disabled={saving || loading}>

              {saving ? 'Saving…' : 'Save permissions'}

            </button>

          )}

        </>

      }

    >

      {loading && <p style={{ color: 'var(--muted)' }}>Loading permissions…</p>}

      {error && <p className="error-msg">{error}</p>}

      {data && !loading && (

        <>

          {data.role.description && (

            <p className="role-permissions-desc">{data.role.description}</p>

          )}

          {isSystem && (

            <p className="muted-block" style={{ marginBottom: '0.75rem' }}>

              System roles are read-only.

            </p>

          )}

          <p className="role-permissions-count">

            {selected.size} of {(data.all_permissions ?? data.permissions).length} permissions selected

          </p>

          {grouped.length === 0 ? (

            <p style={{ color: 'var(--muted)' }}>No permissions available.</p>

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

        </>

      )}

    </Modal>

  )

}
