import { notFound } from 'next/navigation';
import { requireUser, scopeCompany, canViewDept, canEditDept } from '@/server/auth';
import { DEPARTMENTS, isDeptKey } from '@/config/departments';
import { listRecords } from '@/server/records';
import FilterBar from '@/components/layout/FilterBar';
import RecordTable from '@/components/records/RecordTable';

type Props = { params: Promise<{ dept: string }>; searchParams: Promise<{ company?: string }> };

export default async function DeptPage({ params, searchParams }: Props) {
  const user = await requireUser();
  const { dept } = await params;
  if (!isDeptKey(dept)) notFound();
  if (!canViewDept(user, dept)) return <p className="text-gray-400">You don&apos;t have access to this department.</p>;
  const company = scopeCompany(user, (await searchParams).company);
  const cfg = DEPARTMENTS[dept];
  const records = await listRecords(dept, company);
  const canEdit = canEditDept(user, dept);
  return (
    <div className="space-y-5">
      <div className="flex flex-wrap items-end justify-between gap-4">
        <div className="max-w-3xl">
          <div className="kicker">Department data</div>
          <h1 className="h-display mt-1 text-3xl">{cfg.name}</h1>
          <p className="mt-1 text-sm text-gray-400">{cfg.purpose}</p>
          {!canEdit && <p className="mt-1 text-xs text-rag-amber">View only — ask an admin to make you an owner of this department to edit.</p>}
        </div>
        <FilterBar company={company} period="MTD" showPeriod={false} lockCompany={user.company !== 'All'} />
      </div>
      <RecordTable dept={dept} rows={JSON.parse(JSON.stringify(records))} canEdit={canEdit} company={company} />
    </div>
  );
}
