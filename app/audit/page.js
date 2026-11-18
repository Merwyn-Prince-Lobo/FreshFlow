import { redirect } from 'next/navigation';
import { getSession } from '@/lib/auth';
import AdminPagesView from '@/app/components/admin-pages-view';
export default async function AuditPage() {
  const session = await getSession();
  if (!session) redirect('/login');
  if (!['Admin'].includes(session.role)) redirect('/dashboard');
  return <AdminPagesView session={session} page="audit" />;
}
