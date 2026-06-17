import { useEffect, useState } from 'react'
import { NavLink, useLocation } from 'react-router-dom'
import { NavIcon } from './NavIcon'
import { filterNav, isNavGroup, type NavEntry, type NavItem } from '../config/navigation'
import type { AuthUser } from '../types/roles'

type Props = {
  entries: NavEntry[]
  user: AuthUser | null
}

function groupStorageKey(id: string) {
  return `hg_sidebar_group_${id}`
}

function NavLinkItem({ item }: { item: NavItem }) {
  return (
    <NavLink
      to={item.to}
      end={item.end}
      className={({ isActive }) => (isActive ? 'nav active' : 'nav')}
    >
      <NavIcon name={item.icon} />
      <span>{item.label}</span>
    </NavLink>
  )
}

function NavGroupBlock({ group, user }: { group: Extract<NavEntry, { type: 'group' }>; user: AuthUser | null }) {
  const location = useLocation()
  const items = filterNav(group.items, user)
  const childActive = items.some(
    (item) => location.pathname === item.to || (item.to !== '/' && location.pathname.startsWith(item.to + '/')),
  )
  const [open, setOpen] = useState(() => {
    if (childActive) return true
    const saved = localStorage.getItem(groupStorageKey(group.id))
    return saved === '1'
  })

  useEffect(() => {
    if (childActive) setOpen(true)
  }, [childActive, location.pathname])

  const toggle = () => {
    setOpen((prev) => {
      const next = !prev
      localStorage.setItem(groupStorageKey(group.id), next ? '1' : '0')
      return next
    })
  }

  if (items.length === 0) return null

  return (
    <div className={`sidebar-nav-group${open ? ' sidebar-nav-group--open' : ''}`}>
      <button type="button" className="sidebar-nav-group-toggle nav" onClick={toggle} aria-expanded={open}>
        <NavIcon name={group.icon} />
        <span className="sidebar-nav-group-label">{group.label}</span>
        <span className="sidebar-nav-chevron" aria-hidden>
          ›
        </span>
      </button>
      {open && (
        <div className="sidebar-nav-sub">
          {items.map((item) => (
            <NavLink
              key={item.to}
              to={item.to}
              end={item.end}
              className={({ isActive }) => (isActive ? 'nav nav-sub active' : 'nav nav-sub')}
            >
              <span>{item.label}</span>
            </NavLink>
          ))}
        </div>
      )}
    </div>
  )
}

export function SidebarNav({ entries, user }: Props) {
  return (
    <>
      {entries.map((entry) =>
        isNavGroup(entry) ? (
          <NavGroupBlock key={entry.id} group={entry} user={user} />
        ) : (
          <NavLinkItem key={entry.to} item={entry} />
        ),
      )}
    </>
  )
}
