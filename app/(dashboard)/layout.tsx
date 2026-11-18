import Shell from '@/components/layout/Shell';
import { requireUser } from '@/server/auth';

export const dynamic = 'force-dynamic';

export default async function AppLayout({ children }: { children: React.ReactNode }) {
  const user = await requireUser();
  return <Shell user={user}>{children}</Shell>;
}
