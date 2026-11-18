import { redirect } from 'next/navigation';
import { getSession } from '@/lib/auth';
import IssueView from './issue-view';

export default async function IssuePage() {
  const session = await getSession();

  if (!session) redirect('/login');

  if (!['Admin', 'Staff'].includes(session.role)) {
    redirect('/dashboard');
  }

  return <IssueView session={session} />;
}
