import { redirect } from 'next/navigation';
import { getSession } from '@/lib/auth';
import InventoryView from './inventory-view';

export default async function InventoryPage() {
  const session = await getSession();

  if (!session) redirect('/login');

  if (!['Admin', 'Staff'].includes(session.role)) {
    redirect('/dashboard');
  }

  return <InventoryView session={session} />;
}