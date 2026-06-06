import type { ReactNode } from 'react'

type Props = { name: string; className?: string }

export function NavIcon({ name, className = 'nav-icon' }: Props) {
  const paths: Record<string, ReactNode> = {
    home: <path d="M4 10.5L12 4l8 6.5V20a1 1 0 01-1 1h-5v-6H10v6H5a1 1 0 01-1-1v-9.5z" fill="currentColor" />,
    menu: <path d="M4 7h16M4 12h16M4 17h16" stroke="currentColor" strokeWidth="2" strokeLinecap="round" />,
    user: <path d="M12 12a4 4 0 100-8 4 4 0 000 8zm-7 8a7 7 0 0114 0H5z" fill="currentColor" />,
    clock: <path d="M12 8v4l3 2M12 22a10 10 0 100-20 10 10 0 000 20z" stroke="currentColor" strokeWidth="2" fill="none" />,
    calendar: <path d="M8 4V2M16 4V2M4 9h16M6 4h12a2 2 0 012 2v14H6a2 2 0 01-2-2V6a2 2 0 012-2z" stroke="currentColor" strokeWidth="2" fill="none" />,
    wallet: <path d="M4 8h16v10H4V8zm0-2V6a2 2 0 012-2h12a2 2 0 012 2v2M16 14h2" stroke="currentColor" strokeWidth="2" fill="none" />,
    schedule: <path d="M4 6h16M4 12h8M4 18h4" stroke="currentColor" strokeWidth="2" strokeLinecap="round" />,
    loan: <path d="M12 3v18M8 7l4-4 4 4M8 17l4 4 4-4" stroke="currentColor" strokeWidth="2" strokeLinecap="round" fill="none" />,
    benefit: <path d="M12 2l3 7h7l-5.5 4 2 7L12 16l-6.5 4 2-7L2 9h7L12 2z" stroke="currentColor" strokeWidth="1.5" fill="none" />,
    folder: <path d="M4 6h5l2 2h9v10H4V6z" stroke="currentColor" strokeWidth="2" fill="none" />,
    memo: <path d="M6 4h12v16H6V4zm3 4h6M9 12h6M9 16h4" stroke="currentColor" strokeWidth="2" fill="none" />,
    map: <path d="M12 2C8 6 6 9 6 14a6 6 0 0012 0c0-5-2-8-6-12z" stroke="currentColor" strokeWidth="2" fill="none" />,
    overtime: <path d="M12 8v4l3 2M12 4v2M18 12h2M4 12H2" stroke="currentColor" strokeWidth="2" fill="none" />,
    users: <path d="M12 12a4 4 0 100-8M6 20a6 6 0 0112 0M4 12a4 4 0 118 0" stroke="currentColor" strokeWidth="2" fill="none" />,
    key: <path d="M8 11a4 4 0 118 0 4 4 0 01-8 0v2h2v4H6v-6z" fill="currentColor" />,
    settings: <path d="M12 15a3 3 0 100-6 3 3 0 000 6zm8-3a8 8 0 11-16 0 8 8 0 0116 0z" stroke="currentColor" strokeWidth="2" fill="none" />,
    shield: <path d="M12 3l8 4v6c0 5-3.5 8-8 8s-8-3-8-8V7l8-4z" stroke="currentColor" strokeWidth="2" fill="none" />,
  }

  const content = paths[name] ?? paths.home
  const isStroke = ['clock', 'calendar', 'wallet', 'schedule', 'loan', 'benefit', 'folder', 'memo', 'map', 'overtime', 'users', 'settings', 'shield', 'menu'].includes(name)

  return (
    <svg className={className} viewBox="0 0 24 24" aria-hidden width="22" height="22">
      {isStroke ? content : content}
    </svg>
  )
}
