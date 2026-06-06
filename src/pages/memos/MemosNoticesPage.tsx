import { useEffect, useState } from 'react'
import { api } from '../../lib/api'
import { PageHeader } from '../../components/PageHeader'
import { LoadingBlock } from '../../components/LoadingBlock'
import { EmptyState } from '../../components/EmptyState'

interface Announcement {
  id: string
  title: string
  body: string
  priority: string
  publish_at?: string
}

export function MemosNoticesPage() {
  const [items, setItems] = useState<Announcement[]>([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    api<Announcement[]>('/announcements')
      .then(setItems)
      .catch(() => setItems([]))
      .finally(() => setLoading(false))
  }, [])

  return (
    <div>
      <PageHeader title="Memos & Notices" subtitle="Official announcements from HR and management" />
      {loading ? (
        <LoadingBlock />
      ) : items.length === 0 ? (
        <EmptyState title="No notices" description="New memos will show up here when HR publishes them." />
      ) : (
        <div className="memo-list">
          {items.map((a) => (
            <article key={a.id} className={`card memo-card announce-${a.priority}`}>
              <h3 className="memo-title">{a.title}</h3>
              {a.publish_at && (
                <time className="memo-date" dateTime={a.publish_at}>
                  {new Date(a.publish_at.replace(' ', 'T')).toLocaleDateString()}
                </time>
              )}
              <p className="memo-body">{a.body}</p>
            </article>
          ))}
        </div>
      )}
    </div>
  )
}
