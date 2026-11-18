import { notFound } from 'next/navigation';
import Link from 'next/link';
import { requireUser, canEditDept, canViewDept } from '@/server/auth';
import { DEPARTMENTS, isDeptKey } from '@/config/departments';
import { getRecord } from '@/server/records';
import RecordForm from '@/components/records/RecordForm';

export default async function EditRecord({ params }: { params: Promise<{ dept: string; id: string }> }) {
  const user = await requireUser();
  const { dept, id } = await params;
  if (!isDeptKey(dept) || !/^\d+$/.test(id)) notFound();
  const rec = await getRecord(dept, Number(id));
  if (!rec) notFound();
  if (!canViewDept(user, dept) || (user.company !== 'All' && rec.company !== user.company)) return <p className="text-gray-400">Not allowed.</p>;
  const cfg = DEPARTMENTS[dept];
  return (
    <div className="space-y-4">
      <div>
        <Link href={`/d/${dept}`} className="kicker hover:underline">← {cfg.name}</Link>
        <h1 className="h-display mt-1 text-2xl">{String(rec.data[cfg.titleField] ?? `Record #${rec.id}`)}</h1>
        <p className="text-sm text-gray-400">{rec.company}</p>
      </div>
      <RecordForm
        dept={dept}
        id={rec.id}
        initial={JSON.parse(JSON.stringify(rec.data))}
        canEdit={canEditDept(user, dept)}
        lockedCompany={user.company !== 'All' ? user.company : undefined}
        meta={{ source: rec.source, updated_at: String(rec.updated_at) }}
      />
    </div>
  );
}
