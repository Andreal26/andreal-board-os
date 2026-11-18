import { notFound } from 'next/navigation';
import Link from 'next/link';
import { requireUser, canEditDept } from '@/server/auth';
import { DEPARTMENTS, isDeptKey } from '@/config/departments';
import RecordForm from '@/components/records/RecordForm';

export default async function NewRecord({ params }: { params: Promise<{ dept: string }> }) {
  const user = await requireUser();
  const { dept } = await params;
  if (!isDeptKey(dept)) notFound();
  if (!canEditDept(user, dept)) return <p className="text-gray-400">You can view but not edit this department.</p>;
  const cfg = DEPARTMENTS[dept];
  return (
    <div className="space-y-4">
      <div>
        <Link href={`/d/${dept}`} className="kicker hover:underline">← {cfg.name}</Link>
        <h1 className="h-display mt-1 text-2xl">New {cfg.name} record</h1>
      </div>
      <RecordForm dept={dept} initial={{}} canEdit lockedCompany={user.company !== 'All' ? user.company : undefined} />
    </div>
  );
}
