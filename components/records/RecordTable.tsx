'use client';
import Link from 'next/link';
import { useEffect, useMemo, useState } from 'react';
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
  // The list's main date (Sales: Lead Date) is always shown, right after the first column, so "newest first" is visible.
  const dateCol = cfg.dateField ? cfg.fields.find((f) => f.key === cfg.dateField) : undefined;
  const baseCols = cfg.fields.filter((f) => f.col);
  const cols = dateCol && !baseCols.includes(dateCol) ? [baseCols[0], dateCol, ...baseCols.slice(1)] : baseCols;
  const ff = cfg.fields.find((f) => f.key === FILTER_FIELD[dept])!;
  const [q, setQ] = useState('');
  const [filter, setFilter] = useState(initialFilter ?? '');
  // Default: newest first by the list's main date (ties: newest Zoho/opportunity id, then newest record)
  const [sort, setSort] = useState<{ key: string; dir: 1 | -1 } | null>(cfg.dateField ? { key: '__age', dir: -1 } : null);
  const [showImport, setShowImport] = useState(false);
  // Big lists (Sales has 4,000+ deals) render 100 rows at a time; search / filter / sort still cover every row.
  const PAGE = 100;
  const [limit, setLimit] = useState(PAGE);

  const shown = useMemo(() => {
    const needle = q.trim().toLowerCase();
    let out = rows.filter((r) => (!filter || r.data[ff.key] === filter) && (!needle || Object.values(r.data).some((v) => String(v ?? '').toLowerCase().includes(needle))));
    if (sort?.key === '__age') {
      const tie = (r: Row) => Number(String(r.data.opportunityId ?? '').replace(/\D/g, '').slice(-15)) || r.id;
      out = [...out].sort((a, b) => {
        const x = String(a.data[cfg.dateField!] ?? ''), y = String(b.data[cfg.dateField!] ?? '');
        if (x !== y) return !x ? 1 : !y ? -1 : x.localeCompare(y) * sort.dir;
        return (tie(a) - tie(b)) * sort.dir;
      });
    } else if (sort) {
      out = [...out].sort((a, b) => {
        const x = a.data[sort.key], y = b.data[sort.key];
        if (x === y) return 0;
        if (x === null || x === undefined || x === '') return 1;
        if (y === null || y === undefined || y === '') return -1;
        return (typeof x === 'number' && typeof y === 'number' ? x - y : String(x).localeCompare(String(y))) * sort.dir;
      });
    }
    return out;
  }, [rows, q, filter, sort, ff.key, cfg.dateField]);
  useEffect(() => setLimit(PAGE), [q, filter, sort]);
  const visible = shown.slice(0, limit);

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
        {cfg.dateField && (
          <button
            className={`btn-ghost ${sort?.key === '__age' ? 'border-teal-400/60 text-teal-200' : ''}`}
            onClick={() => setSort(sort?.key === '__age' ? { key: '__age', dir: sort.dir === -1 ? 1 : -1 } : { key: '__age', dir: -1 })}
            title={`Sort by ${dateCol?.label ?? 'date'}`}
          >
            {sort?.key === '__age' && sort.dir === 1 ? 'Oldest first ↑' : 'Newest first ↓'}
          </button>
        )}
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
        {visible.map((r) => {
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
            {visible.map((r) => (
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
      {shown.length > limit && (
        <div className="flex flex-wrap items-center justify-center gap-3 py-2 text-sm text-gray-400">
          <span>Showing {limit.toLocaleString('en-IN')} of {shown.length.toLocaleString('en-IN')}</span>
          <button className="btn-ghost" onClick={() => setLimit(limit + PAGE * 2)}>Show more</button>
          <button className="btn-ghost" onClick={() => setLimit(shown.length)}>Show all</button>
        </div>
      )}
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
