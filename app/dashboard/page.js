
import { redirect } from 'next/navigation';
import { getSession } from '@/lib/auth';
import DashboardView from './dashboard-view';

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

  const items = MENU.filter((item) =>
    item.roles.includes(session.role)
  );

  return (
    <DashboardView session={session} items={items} />
  );
}
