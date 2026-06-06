import { useCallback, useEffect, useRef, useState } from 'react'
import { Link } from 'react-router-dom'
import { api } from '../lib/api'

type NotificationItem = {
  id: string
  type: string
  title: string
  body: string | null
  link: string | null
  is_read: number | boolean
  created_at: string
}

type NotificationPayload = {
  items: NotificationItem[]
  unread_count: number
}

export function NotificationBell() {
  const [open, setOpen] = useState(false)
  const [data, setData] = useState<NotificationPayload | null>(null)
  const [loading, setLoading] = useState(false)
  const panelRef = useRef<HTMLDivElement>(null)

  const load = useCallback(async () => {
    setLoading(true)
    try {
      setData(await api<NotificationPayload>('/notifications'))
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => {
    load()
    const id = window.setInterval(load, 60_000)
    return () => window.clearInterval(id)
  }, [load])

  useEffect(() => {
    if (!open) return
    const onDoc = (e: MouseEvent) => {
      if (panelRef.current && !panelRef.current.contains(e.target as Node)) {
        setOpen(false)
      }
    }
    document.addEventListener('mousedown', onDoc)
    return () => document.removeEventListener('mousedown', onDoc)
  }, [open])

  const markRead = async (id: string) => {
    await api(`/notifications/${id}`, { method: 'PUT', body: '{}' })
    load()
  }

  const markAllRead = async () => {
    await api('/notifications/read-all', { method: 'PUT', body: '{}' })
    load()
  }

  const unread = data?.unread_count ?? 0

  return (
    <div className="notification-bell" ref={panelRef}>
      <button
        type="button"
        className="notification-bell-btn"
        aria-label={`Notifications${unread ? `, ${unread} unread` : ''}`}
        onClick={() => {
          setOpen((v) => !v)
          if (!open) load()
        }}
      >
        <span aria-hidden>🔔</span>
        {unread > 0 && <span className="notification-bell-badge">{unread > 9 ? '9+' : unread}</span>}
      </button>

      {open && (
        <div className="notification-panel card">
          <div className="notification-panel-head">
            <strong>Notifications</strong>
            {unread > 0 && (
              <button type="button" className="text-link" onClick={markAllRead}>
                Mark all read
              </button>
            )}
          </div>
          {loading && !data ? (
            <p className="muted-block">Loading…</p>
          ) : !data?.items.length ? (
            <p className="muted-block">No notifications yet.</p>
          ) : (
            <ul className="notification-list">
              {data.items.map((n) => (
                <li key={n.id} className={n.is_read ? '' : 'notification-item--unread'}>
                  <div className="notification-item-body">
                    <strong>{n.title}</strong>
                    {n.body && <p>{n.body}</p>}
                    <time className="notification-time">
                      {new Date(n.created_at.replace(' ', 'T')).toLocaleString()}
                    </time>
                  </div>
                  <div className="notification-item-actions">
                    {n.link && (
                      <Link to={n.link} className="text-link" onClick={() => markRead(n.id)}>
                        View
                      </Link>
                    )}
                    {!n.is_read && (
                      <button type="button" className="text-link" onClick={() => markRead(n.id)}>
                        Dismiss
                      </button>
                    )}
                  </div>
                </li>
              ))}
            </ul>
          )}
        </div>
      )}
    </div>
  )
}
