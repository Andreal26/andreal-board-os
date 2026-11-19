import Link from 'next/link';
import { notFound } from 'next/navigation';
import { requireUser, scopeCompany, canViewDept } from '@/server/auth';
import { listTasks, taskKindCounts, TASK_KINDS, type TaskKind } from '@/server/integrations/zoho-projects';
import FilterBar from '@/components/layout/FilterBar';

type Props = { params: Promise<{ dept: string }>; searchParams: Promise<{ company?: string; kind?: string }> };

const fmtDate = (d: string | null) => (d ? new Date(`${d}T00:00:00Z`).toLocaleDateString('en-GB', { day: '2-digit', month: 'short', year: 'numeric', timeZone: 'UTC' }) : '—');
const todayIst = () => new Date(Date.now() + 5.5 * 3600_000).toISOString().slice(0, 10);

/** Drill-down behind the Operations task KPIs: the actual open Zoho Projects tasks (as of the last sync). */
export default async function OpsTasksPage({ params, searchParams }: Props) {
  const user = await requireUser();
  const { dept } = await params;
  if (dept !== 'operations') notFound();
  if (!canViewDept(user, 'operations')) return <p className="text-gray-400">You don&apos;t have access to this department.</p>;
  const sp = await searchParams;
  const company = scopeCompany(user, sp.company);
  const kind = (sp.kind && sp.kind in TASK_KINDS ? sp.kind : 'month') as TaskKind;
  const [tasks, counts] = await Promise.all([listTasks(kind, company), taskKindCounts(company)]);
  const today = todayIst();
  const qs = (k: string) => `?kind=${k}${company !== 'All' ? `&company=${company}` : ''}`;

  return (
    <div className="space-y-5">
      <div className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <Link href={`/d/operations${company !== 'All' ? `?company=${company}` : ''}`} className="text-xs text-teal-300 hover:underline">← Operations</Link>
          <h1 className="h-display mt-1 text-2xl sm:text-3xl">{TASK_KINDS[kind].label}</h1>
          <p className="mt-1 text-sm text-gray-400">Open tasks from Zoho Projects (live projects, as of the last sync). Click a task to open it in Zoho.</p>
        </div>
        <FilterBar company={company} period="MTD" showPeriod={false} lockCompany={user.company !== 'All'} />
      </div>

      <div className="flex flex-wrap gap-2">
        {(Object.keys(TASK_KINDS) as TaskKind[]).map((k) => (
          <Link key={k} href={qs(k)} className={`rounded-full border px-3 py-1 text-xs ${k === kind ? 'border-teal-400 bg-teal-400/10 text-teal-200' : 'border-white/10 text-gray-300 hover:border-white/30'}`}>
            {TASK_KINDS[k].label} <span className="ml-1 font-semibold">{counts[k]}</span>
          </Link>
        ))}
      </div>

      {/* Phones: one card per task */}
      <div className="space-y-2 md:hidden">
        {tasks.map((t) => {
          const late = t.due_date && t.due_date < today ? Math.round((Date.parse(today) - Date.parse(t.due_date)) / 86_400_000) : 0;
          return (
            <a key={`m-${t.task_key}-${t.link}`} href={t.link} target="_blank" rel="noopener noreferrer" className="card block p-3">
              <div className="text-[11px] text-gray-500">{t.task_key} · {t.tasklist}</div>
              <div className="font-medium leading-snug text-white">{t.name}</div>
              <div className="mt-1 text-xs text-gray-400">{t.project_name}</div>
              <div className="mt-2 flex items-center justify-between gap-2 text-xs">
                <span className="truncate text-gray-300">{t.owners || 'Unassigned'}</span>
                <span className={late ? 'text-rag-red' : t.due_date === today ? 'text-rag-amber' : 'text-gray-300'}>
                  {fmtDate(t.due_date)}{late ? ` · ${late}d late` : ''}
                </span>
              </div>
            </a>
          );
        })}
        {!tasks.length && <div className="card p-6 text-center text-sm text-gray-500">No tasks here.</div>}
      </div>

      <div className="card hidden overflow-x-auto md:block">
        <table className="tbl w-full table-fixed">
          <thead>
            <tr><th className="w-[34%]">Task</th><th className="w-[20%]">Project</th><th className="w-[14%]">Task list</th><th className="w-[12%]">Owner</th><th className="w-[11%]">Due</th><th className="w-[9%]">Status</th></tr>
          </thead>
          <tbody>
            {tasks.map((t) => {
              const late = t.due_date && t.due_date < today ? Math.round((Date.parse(today) - Date.parse(t.due_date)) / 86_400_000) : 0;
              return (
                <tr key={`${t.task_key}-${t.link}`}>
                  <td style={{ whiteSpace: 'normal', wordBreak: 'break-word' }}>
                    <a href={t.link} target="_blank" rel="noopener noreferrer" className="text-white hover:text-teal-300">
                      <span className="mr-2 text-[11px] text-gray-500">{t.task_key}</span>{t.name}
                    </a>
                  </td>
                  <td className="text-gray-300" style={{ whiteSpace: 'normal', wordBreak: 'break-word' }}>{t.project_name}</td>
                  <td className="text-gray-400" style={{ whiteSpace: 'normal', wordBreak: 'break-word' }}>{t.tasklist}</td>
                  <td className="text-gray-300" style={{ whiteSpace: 'normal', wordBreak: 'break-word' }}>{t.owners || <span className="text-ink-500">Unassigned</span>}</td>
                  <td className={late ? 'text-rag-red' : t.due_date === today ? 'text-rag-amber' : ''} style={{ whiteSpace: 'normal' }}>
                    {fmtDate(t.due_date)}{late ? <div className="text-[11px]">{late}d late</div> : null}
                  </td>
                  <td className="text-gray-300">{t.status}</td>
                </tr>
              );
            })}
            {!tasks.length && <tr><td colSpan={6} className="py-6 text-center text-gray-500">No tasks here — or Zoho Projects hasn&apos;t synced yet (Settings → Sync integrations → Run now).</td></tr>}
          </tbody>
        </table>
      </div>
    </div>
  );
}
