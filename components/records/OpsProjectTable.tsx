'use client';
import Link from 'next/link';
import { useMemo, useState } from 'react';
import type { RecordData } from '@/config/departments';
import { fmtDate } from '@/lib/format';
import ImportDialog from '@/components/records/ImportDialog';

interface Row { id: number; company: string; source: string; data: RecordData; updated_at: string }

const DELIVERY_TONE: Record<string, string> = {
  Delayed: 'text-rag-red', 'At Risk': 'text-rag-amber', 'On Track': 'text-rag-green', Delivered: 'text-teal-300', Closed: 'text-gray-400',
};

const n = (v: unknown) => (Number.isFinite(Number(v)) ? Number(v) : 0);
const initials = (name: string) => name.split(/\s+/).filter(Boolean).slice(0, 2).map((w) => w[0]?.toUpperCase()).join('');
/** Newest first = latest created in Zoho (falls back to the project key number, e.g. AN-1308). */
const ageKey = (r: Row) => String(r.data.createdOn ?? '') || String(n(String(r.data.zohoKey ?? r.data.jobId ?? '').replace(/\D/g, ''))).padStart(10, '0');

type SortKey = 'age' | 'jobName' | 'completionPct' | 'owner' | 'zohoStatus' | 'tasksTotal' | 'startDate' | 'committedDate' | 'deliveryStatus';

/** Operations project list styled after Zoho Projects → Active Projects. */
export default function OpsProjectTable({ rows, canEdit, company, initialFilter }: { rows: Row[]; canEdit: boolean; company: string; initialFilter?: string }) {
  const [q, setQ] = useState('');
  const [status, setStatus] = useState('');
  const [delivery, setDelivery] = useState(initialFilter ?? '');
  const [sort, setSort] = useState<{ key: SortKey; dir: 1 | -1 }>({ key: 'age', dir: -1 });
  const [showImport, setShowImport] = useState(false);

  const statuses = useMemo(() => [...new Set(rows.map((r) => String(r.data.zohoStatus ?? '')).filter(Boolean))].sort(), [rows]);

  const shown = useMemo(() => {
    const needle = q.trim().toLowerCase();
    const out = rows.filter((r) =>
      (!status || r.data.zohoStatus === status) &&
      (!delivery || r.data.deliveryStatus === delivery) &&
      (!needle || Object.values(r.data).some((v) => String(v ?? '').toLowerCase().includes(needle))));
    const val = (r: Row): string | number => (sort.key === 'age' ? ageKey(r) : (r.data[sort.key] ?? '') as string | number);
    return [...out].sort((a, b) => {
      const x = val(a), y = val(b);
      if (x === y) return 0;
      if (x === '' || x === null) return 1;
      if (y === '' || y === null) return -1;
      return (typeof x === 'number' && typeof y === 'number' ? x - y : String(x).localeCompare(String(y))) * sort.dir;
    });
  }, [rows, q, status, delivery, sort]);

  const qs = company !== 'All' ? `?company=${company}` : '';
  const th = (label: string, key?: SortKey, cls = '') => (
    <th className={cls}>
      {key ? (
        <button className="uppercase hover:text-white" onClick={() => setSort(sort.key === key ? { key, dir: sort.dir === 1 ? -1 : 1 } : { key, dir: 1 })}>
          {label}{sort.key === key ? (sort.dir === 1 ? ' ↑' : ' ↓') : ''}
        </button>
      ) : label}
    </th>
  );

  return (
    <div className="space-y-3">
      <div className="flex flex-wrap items-center gap-2">
        <input aria-label="Search" className="input w-full sm:w-60" placeholder="Search projects…" value={q} onChange={(e) => setQ(e.target.value)} />
        <select aria-label="Filter by Zoho status" className="input min-w-0 flex-1 sm:w-auto sm:flex-none" value={status} onChange={(e) => setStatus(e.target.value)}>
          <option value="">All statuses</option>
          {statuses.map((s) => <option key={s}>{s}</option>)}
        </select>
        <select aria-label="Filter by delivery" className="input min-w-0 flex-1 sm:w-auto sm:flex-none" value={delivery} onChange={(e) => setDelivery(e.target.value)}>
          <option value="">All delivery</option>
          {['On Track', 'At Risk', 'Delayed', 'Delivered', 'Closed'].map((s) => <option key={s}>{s}</option>)}
        </select>
        <button
          className={`btn-ghost ${sort.key === 'age' ? 'border-teal-400/60 text-teal-200' : ''}`}
          onClick={() => setSort(sort.key === 'age' ? { key: 'age', dir: sort.dir === -1 ? 1 : -1 } : { key: 'age', dir: -1 })}
          title="Sort by when the project was created in Zoho"
        >
          {sort.key === 'age' && sort.dir === 1 ? 'Oldest first ↑' : 'Newest first ↓'}
        </button>
        <span className="text-xs text-gray-500">Total count: {shown.length}{shown.length !== rows.length ? ` of ${rows.length}` : ''}</span>
        <div className="flex w-full flex-wrap gap-2 sm:ml-auto sm:w-auto">
          <a className="btn-ghost" href={`/api/export/operations${qs}`}>Export CSV</a>
          {canEdit && <button className="btn-ghost" onClick={() => setShowImport(true)}>Import CSV</button>}
          {canEdit && <Link className="btn-primary" href="/d/operations/new">+ Add record</Link>}
        </div>
      </div>

      {/* Phones: one card per project */}
      <div className="space-y-2 md:hidden">
        {shown.map((r) => {
          const d = r.data;
          const closed = n(d.tasksClosed), total = n(d.tasksTotal), open = Math.max(0, total - closed);
          const pct = d.completionPct !== undefined && d.completionPct !== null ? Math.round(n(d.completionPct)) : total ? Math.round((closed / total) * 100) : 0;
          return (
            <div key={r.id} className="card p-3">
              <div className="flex items-start gap-2">
                <div className="min-w-0 flex-1">
                  <div className="text-[11px] text-gray-500">{String(d.zohoKey ?? d.jobId ?? '')}</div>
                  <Link href={`/d/operations/${r.id}`} className="block font-medium leading-snug text-white">{String(d.jobName ?? '—')}</Link>
                </div>
                {d.zohoStatus ? (
                  <span className="shrink-0 rounded px-2 py-1 text-[11px] font-semibold text-white" style={{ background: String(d.zohoStatusColor ?? '#2cc8ba') }}>{String(d.zohoStatus)}</span>
                ) : null}
              </div>
              <div className="mt-2 flex items-center gap-2 text-xs tabular-nums">
                <span className="relative h-3.5 flex-1 overflow-hidden rounded bg-white/10">
                  <span className="absolute inset-y-0 left-0 bg-rag-green/80" style={{ width: `${pct}%` }} />
                  <span className="absolute inset-0 grid place-items-center text-[10px] text-white">{pct}%</span>
                </span>
                <span className="text-gray-400">{closed} closed · {open} open</span>
              </div>
              <div className="mt-2 grid grid-cols-2 gap-x-3 gap-y-1 text-xs text-gray-400">
                <div className="truncate">👤 {String(d.owner ?? '—')}</div>
                <div className={`text-right ${DELIVERY_TONE[String(d.deliveryStatus)] ?? ''}`}>{String(d.deliveryStatus ?? '—')}{n(d.delayDays) > 0 ? ` (${n(d.delayDays)}d)` : ''}</div>
                <div>Start {fmtDate(d.startDate as string) || '—'}</div>
                <div className="text-right">End {fmtDate(d.committedDate as string) || '—'}</div>
              </div>
              {d.zohoLink ? <a href={String(d.zohoLink)} target="_blank" rel="noopener noreferrer" className="mt-2 inline-block text-xs text-teal-300">Open in Zoho ↗</a> : null}
            </div>
          );
        })}
        {!shown.length && <div className="card p-6 text-center text-sm text-ink-500">{rows.length ? 'No projects match the filter.' : 'No projects yet.'}</div>}
      </div>

      <div className="card hidden overflow-x-auto md:block">
        <table className="tbl">
          <thead>
            <tr>
              {th('ID', 'age')}
              {th('Project name', 'jobName')}
              {th('%', 'completionPct', 'text-right')}
              {th('Owner', 'owner')}
              {th('Status', 'zohoStatus')}
              {th('Tasks', 'tasksTotal')}
              {th('Phases')}
              {th('Issues')}
              {th('Start date', 'startDate')}
              {th('End date', 'committedDate')}
              {th('Delivery', 'deliveryStatus')}
            </tr>
          </thead>
          <tbody>
            {shown.map((r) => {
              const d = r.data;
              const closed = n(d.tasksClosed), total = n(d.tasksTotal), open = Math.max(0, total - closed);
              // Same as Zoho's Tasks column: closed · project % · open
              const pct = d.completionPct !== undefined && d.completionPct !== null ? Math.round(n(d.completionPct)) : total ? Math.round((closed / total) * 100) : 0;
              const phases = n(d.phasesOpen) + n(d.phasesClosed);
              const issues = n(d.issuesOpen) + n(d.issuesClosed);
              const owner = String(d.owner ?? '');
              return (
                <tr key={r.id}>
                  <td className="text-xs text-gray-400">{String(d.zohoKey ?? d.jobId ?? '—')}</td>
                  <td className="min-w-[240px]" style={{ whiteSpace: 'normal' }}>
                    <Link className="text-white hover:text-teal-300" href={`/d/operations/${r.id}`}>{String(d.jobName ?? '—')}</Link>
                    {d.zohoLink ? (
                      <a href={String(d.zohoLink)} target="_blank" rel="noopener noreferrer" className="ml-2 text-[11px] text-gray-500 hover:text-teal-300" title="Open in Zoho Projects">Zoho ↗</a>
                    ) : null}
                  </td>
                  <td className="text-right tabular-nums">{d.completionPct !== undefined && d.completionPct !== null ? `${Math.round(n(d.completionPct))}%` : '—'}</td>
                  <td>
                    {owner ? (
                      <span className="inline-flex items-center gap-1.5 rounded-full border border-white/10 py-0.5 pl-0.5 pr-2 text-xs">
                        <span className="grid h-5 w-5 place-items-center rounded-full bg-fuchsia-400/30 text-[10px] font-semibold text-fuchsia-100">{initials(owner)}</span>
                        <span className="max-w-[120px] truncate">{owner}</span>
                      </span>
                    ) : <span className="text-ink-600">—</span>}
                  </td>
                  <td className="p-0">
                    {d.zohoStatus ? (
                      <span className="block px-3 py-2 text-center text-xs font-semibold text-white" style={{ background: String(d.zohoStatusColor ?? '#2cc8ba') }}>{String(d.zohoStatus)}</span>
                    ) : <span className="px-3 text-ink-600">—</span>}
                  </td>
                  <td>
                    <div className="flex items-center gap-2 text-xs tabular-nums" title={`${closed} closed · ${open} open`}>
                      <span className="w-6 text-right">{closed}</span>
                      <span className="relative h-3.5 w-20 overflow-hidden rounded bg-white/10">
                        <span className="absolute inset-y-0 left-0 bg-rag-green/80" style={{ width: `${pct}%` }} />
                        <span className="absolute inset-0 grid place-items-center text-[10px] text-white">{pct}%</span>
                      </span>
                      <span className="w-8" title={`${open} open of ${total}`}>{open}</span>
                    </div>
                  </td>
                  <td>
                    {phases ? <span className="text-xs">{n(d.phasesClosed)} / {phases} closed</span>
                      : <span className="rounded bg-white/10 px-2 py-0.5 text-[10px] text-gray-400">No Phases</span>}
                  </td>
                  <td>
                    {issues ? <span className={`text-xs ${n(d.issuesOpen) ? 'text-rag-amber' : ''}`}>{n(d.issuesOpen)} open / {issues}</span>
                      : <span className="rounded bg-white/10 px-2 py-0.5 text-[10px] text-gray-400">No Issues</span>}
                  </td>
                  <td className="text-xs">{fmtDate(d.startDate as string) || '—'}</td>
                  <td className="text-xs">{fmtDate(d.committedDate as string) || '—'}</td>
                  <td className={`text-xs ${DELIVERY_TONE[String(d.deliveryStatus)] ?? ''}`}>
                    {String(d.deliveryStatus ?? '—')}{n(d.delayDays) > 0 ? <span className="ml-1 text-[10px]">({n(d.delayDays)}d)</span> : null}
                  </td>
                </tr>
              );
            })}
            {!shown.length && (
              <tr><td colSpan={11} className="py-10 text-center text-ink-500">{rows.length ? 'No projects match the filter.' : 'No projects yet — connect Zoho Projects in Settings.'}</td></tr>
            )}
          </tbody>
        </table>
      </div>
      {showImport && <ImportDialog dept="operations" onClose={() => setShowImport(false)} />}
    </div>
  );
}
