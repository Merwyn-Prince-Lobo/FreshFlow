import { redirect } from 'next/navigation';
import Link from 'next/link';
import { getSession } from '@/lib/auth';
import LogoutButton from './logout-button';

// Menu per role. The API enforces the same rules; hiding links is only convenience.
const MENU = [
  { href: '/inventory', label: 'Inventory', roles: ['Admin', 'Staff'] },
  { href: '/issue', label: 'Issue stock', roles: ['Admin', 'Staff'] },
  { href: '/waste', label: 'Record waste', roles: ['Admin', 'Staff'] },
  { href: '/alerts', label: 'Alerts', roles: ['Admin', 'Staff'] },
  { href: '/temperature', label: 'Temperature', roles: ['Admin', 'Staff'] },
  { href: '/suppliers', label: 'Suppliers & products', roles: ['Admin'] },
  { href: '/users', label: 'Users', roles: ['Admin'] },
  { href: '/analytics', label: 'Waste analytics', roles: ['Admin'] },
  { href: '/reports', label: 'Reports', roles: ['Admin'] },
  { href: '/audit', label: 'Audit trail', roles: ['Admin'] },
];

export default async function Dashboard() {
  const session = await getSession();
  if (!session) redirect('/login');
  const items = MENU.filter((m) => m.roles.includes(session.role));

  return (
    <div style={{ display: 'flex', minHeight: '100vh' }}>
      <nav style={{ width: 220, padding: 20, background: '#fff', borderRight: '1px solid #e2e6df' }}>
        <h2 style={{ marginTop: 0 }}>FreshFlow</h2>
        <ul style={{ listStyle: 'none', padding: 0, display: 'grid', gap: 8 }}>
          {items.map((m) => (
            <li key={m.href}><Link href={m.href}>{m.label}</Link></li>
          ))}
        </ul>
        <LogoutButton />
      </nav>
      <main style={{ flex: 1, padding: 32 }}>
        <h1 style={{ marginTop: 0 }}>Welcome, {session.name}</h1>
        <p>Signed in as <b>{session.role}</b>. Expiry-risk cards and charts arrive in Phase 5.</p>
      </main>
    </div>
  );
}
