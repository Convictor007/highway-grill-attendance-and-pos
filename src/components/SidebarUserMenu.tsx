import { useEffect, useRef, useState } from 'react'

type Props = {
  primary: string
  secondary?: string | null
  onLogout: () => void | Promise<void>
}

export function SidebarUserMenu({ primary, secondary, onLogout }: Props) {
  const [open, setOpen] = useState(false)
  const rootRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    if (!open) return
    const onDocClick = (e: MouseEvent) => {
      if (rootRef.current && !rootRef.current.contains(e.target as Node)) {
        setOpen(false)
      }
    }
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') setOpen(false)
    }
    document.addEventListener('mousedown', onDocClick)
    document.addEventListener('keydown', onKey)
    return () => {
      document.removeEventListener('mousedown', onDocClick)
      document.removeEventListener('keydown', onKey)
    }
  }, [open])

  const handleLogout = async () => {
    setOpen(false)
    await onLogout()
  }

  return (
    <div className={`sidebar-user-menu${open ? ' sidebar-user-menu--open' : ''}`} ref={rootRef}>
      {open && (
        <div className="sidebar-user-dropdown" role="menu">
          <button type="button" className="sidebar-user-dropdown-item" role="menuitem" onClick={handleLogout}>
            Sign out
          </button>
        </div>
      )}
      <button
        type="button"
        className="sidebar-user-trigger"
        onClick={() => setOpen((v) => !v)}
        aria-expanded={open}
        aria-haspopup="menu"
      >
        <span className="sidebar-user-trigger-text">
          <span className="sidebar-user-primary">{primary}</span>
          {secondary && <span className="sidebar-user-secondary">{secondary}</span>}
        </span>
        <svg
          className="sidebar-user-chevron"
          viewBox="0 0 24 24"
          width="16"
          height="16"
          aria-hidden
        >
          <path
            d="M6 9l6 6 6-6"
            fill="none"
            stroke="currentColor"
            strokeWidth="2"
            strokeLinecap="round"
            strokeLinejoin="round"
          />
        </svg>
      </button>
    </div>
  )
}
