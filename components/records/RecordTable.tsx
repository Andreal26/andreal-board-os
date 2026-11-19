'use client';
import Link from 'next/link';
import { useMemo, useState } from 'react';
import { DEPARTMENTS, type DeptKey, type RecordData } from '@/config/departments';
import { LISTS } from '@/config/lists';
import { fmtField } from '@/lib/format';
import ImportDialog from '@/components/records/ImportDialog';

const FILTER_FIELD: Record<DeptKey, string> = {
  operations: 'deliveryStatus', sales: 'dealStatus', marketing: 'channel', hr: 'employmentStatus', cashflow: 'type', rnd: 'stage',
};

interface Row { id: number; company: string; source: string; data: RecordData; updated_at: string }

export default function RecordTable({ dept, rows, canEdit, company, initialFilter }: { dept: DeptKey; rows: Row[]; canEdit: boolean; company: string; initialFilter?: string }) {
  const cfg = DEPARTMENTS[dept];
  const cols = cfg.fields.filter((f) => f.col);
  const ff = cfg.fields.find((f) => f.key === FILTER_FIELD[dept])!;
  const [q, setQ] = useState('');
  const [filter, setFilter] = useState(initialFilter ?? '');
  const [sort, setSort] = useState<{ key: string; dir: 1 | -1 } | null>(null);
  const [showImport, setShowImport] = useState(false);

  const shown = useMemo(() => {
    const needle = q.trim().toLowerCase();
    let out = rows.filter((r) => (!filter || r.data[ff.key] === filter) && (!needle || Object.values(r.data).some((v) => String(v ?? '').toLowerCase().includes(needle))));
    if (sort) {
      out = [...out].sort((a, b) => {
        const x = a.data[sort.key], y = b.data[sort.key];
        if (x === y) return 0;
        if (x === null || x === undefined || x === '') return 1;
        if (y === null || y === undefined || y === '') return -1;
        return (typeof x === 'number' && typeof y === 'number' ? x - y : String(x).localeCompare(String(y))) * sort.dir;
      });
    }
    return out;
  }, [rows, q, filter, sort, ff.key]);

  const options = ff.key === 'company' ? ['Andreal', 'Anderson'] : ff.list ? LISTS[ff.list] : [];
  const qs = company !== 'All' ? `?company=${company}` : '';

  return (
    <div className="space-y-3">
      <div className="flex flex-wrap items-center gap-2">
        <input aria-label="Search" className="input w-full sm:w-64" placeholder="Search…" value={q} onChange={(e) => setQ(e.target.value)} />
        <select aria-label={`Filter by ${ff.label}`} className="input min-w-0 flex-1 sm:w-auto sm:flex-none" value={filter} onChange={(e) => setFilter(e.target.value)}>
          <option value="">All {ff.label.toLowerCase()}</option>
          {options.map((o) => <option key={o}>{o}</option>)}
        </select>
        <span className="text-xs text-gray-500">{shown.length} of {rows.length}</span>
        <div className="flex w-full flex-wrap gap-2 sm:ml-auto sm:w-auto">
          <a className="btn-ghost" href={`/api/export/${dept}${qs}`}>Export CSV</a>
          {canEdit && <a className="btn-ghost" href={`/api/export/${dept}?template=1`}>CSV template</a>}
          {canEdit && <button className="btn-ghost" onClick={() => setShowImport(true)}>Import CSV</button>}
          {canEdit && <Link className="btn-primary" href={`/d/${dept}/new`}>+ Add {cfg.name === 'Cashflow / Accounts' ? 'entry' : 'record'}</Link>}
        </div>
      </div>

      {/* Phones: one card per record — first column is the title, the rest as label/value pairs */}
      <div className="space-y-2 md:hidden">
        {shown.map((r) => {
          const [first, ...rest] = cols;
          return (
            <Link key={r.id} href={`/d/${dept}/${r.id}`} className="card block p-3">
              <div className="font-medium leading-snug text-white">{fmtField(r.data[cfg.titleField ?? first.key] ?? r.data[first.key], first.type) || '—'}</div>
              <dl className="mt-2 grid grid-cols-2 gap-x-3 gap-y-1 text-xs">
                {rest.slice(0, 8).map((c) => {
                  const v = fmtField(r.data[c.key], c.type);
                  return (
                    <div key={c.key} className="min-w-0">
                      <dt className="truncate text-[10px] uppercase tracking-wide text-ink-500">{c.label}</dt>
                      <dd className={`truncate ${TONE[v] ?? 'text-gray-200'}`}>{v || '—'}</dd>
                    </div>
                  );
                })}
              </dl>
            </Link>
          );
        })}
        {!shown.length && <div className="card p-6 text-center text-sm text-ink-500">{rows.length ? 'No rows match the filter.' : 'No records yet.'}</div>}
      </div>

      <div className="card hidden overflow-x-auto md:block">
        <table className="tbl">
          <thead>
            <tr>
              {cols.map((c) => (
                <th key={c.key}>
                  <button className="uppercase hover:text-white" onClick={() => setSort(sort?.key === c.key ? { key: c.key, dir: sort.dir === 1 ? -1 : 1 } : { key: c.key, dir: 1 })}>
                    {c.label}{sort?.key === c.key ? (sort.dir === 1 ? ' ↑' : ' ↓') : ''}
                  </button>
                </th>
              ))}
              <th>Source</th>
            </tr>
          </thead>
          <tbody>
            {shown.map((r) => (
              <tr key={r.id}>
                {cols.map((c, i) => {
                  const v = fmtField(r.data[c.key], c.type);
                  const right = ['currency', 'number', 'percent', 'score'].includes(c.type);
                  return (
                    <td key={c.key} className={right ? 'text-right tabular-nums' : ''}>
                      {i <= 1 || c.key === cfg.titleField ? (
                        <Link className="text-white hover:text-teal-300" href={`/d/${dept}/${r.id}`}>{v || '—'}</Link>
                      ) : (
                        <Cell field={c.key} value={v} />
                      )}
                    </td>
                  );
                })}
                <td className="text-xs text-gray-500">{r.source}</td>
              </tr>
            ))}
            {!shown.length && (
              <tr><td colSpan={cols.length + 1} className="py-10 text-center text-ink-500">{rows.length ? 'No rows match the filter.' : 'No records yet — add one or import a CSV.'}</td></tr>
            )}
          </tbody>
        </table>
      </div>
      {showImport && <ImportDialog dept={dept} onClose={() => setShowImport(false)} />}
    </div>
  );
}

const TONE: Record<string, string> = {
  Delayed: 'text-rag-red', 'At Risk': 'text-rag-amber', 'On Track': 'text-rag-green', Delivered: 'text-teal-300',
  Won: 'text-rag-green', Lost: 'text-rag-red', Hot: 'text-coral-400', Critical: 'text-rag-red', High: 'text-rag-amber', Yes: 'text-coral-300',
};
function Cell({ field, value }: { field: string; value: string }) {
  if (field === 'blocker' && value) return <span className="text-rag-amber">{value}</span>;
  return <span className={TONE[value] ?? ''}>{value || <span className="text-ink-600">—</span>}</span>;
}
