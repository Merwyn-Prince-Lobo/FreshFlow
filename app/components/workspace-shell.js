'use client';
import Link from 'next/link';
import LogoutButton from '@/app/dashboard/logout-button';

const NAV = [
  { label: 'Dashboard', href: '/dashboard', icon: '⌂', group: 'WORKSPACE', roles: ['Admin','Staff'] },
  { label: 'Inventory', href: '/inventory', icon: '▦', group: 'DAILY OPERATIONS', roles: ['Admin','Staff'] },
  { label: 'Issue Stock', href: '/issue', icon: '↗', roles: ['Admin','Staff'] },
  { label: 'Record Waste', href: '/waste', icon: '♻', roles: ['Admin','Staff'] },
  { label: 'Alerts', href: '/alerts', icon: '♢', roles: ['Admin','Staff'] },
  { label: 'Temperature', href: '/temperature', icon: '♨', roles: ['Admin','Staff'] },
  { label: 'Suppliers & Products', href: '/suppliers', icon: '⌑', group: 'MANAGEMENT', roles: ['Admin'] },
  { label: 'Users', href: '/users', icon: '♙', roles: ['Admin'] },
  { label: 'Waste Analytics', href: '/analytics', icon: '▥', roles: ['Admin'] },
  { label: 'Reports', href: '/reports', icon: '▤', roles: ['Admin'] },
  { label: 'Audit Trail', href: '/audit', icon: '◈', roles: ['Admin'] },
];
export default function WorkspaceShell({ session, active, title, eyebrow, description, children }) {
  return <div className="ff-layout"><aside className="ff-sidebar">
    <Link className="ff-brand" href="/dashboard"><span className="ff-brand-mark">🌿</span><span>FreshFlow</span></Link>
    <div className="ff-nav-scroll">{NAV.filter(n=>n.roles.includes(session?.role)).map((n,i)=><div key={n.href}>
      {n.group && <div className="ff-nav-label">{n.group}</div>}
      <Link className={`ff-nav-item ${active===n.href?'is-active':''}`} href={n.href}><span className="ff-nav-icon">{n.icon}</span>{n.label}</Link>
    </div>)}</div>
    <div className="ff-sidebar-footer"><div className="ff-user-chip"><div className="ff-avatar">{(session?.name||'U').slice(0,1).toUpperCase()}</div><div><b>{session?.name}</b><small>{session?.role}</small></div></div><LogoutButton /></div>
  </aside><main className="ff-main"><header className="ff-page-head"><div><small>{eyebrow||'FreshFlow workspace'}</small><h1>{title}</h1>{description&&<p>{description}</p>}</div><div className="ff-head-user"><span className="ff-live-dot"/> Operational workspace <div className="ff-avatar ff-avatar-small">{(session?.name||'U').slice(0,1).toUpperCase()}</div></div></header>{children}</main></div>
}
