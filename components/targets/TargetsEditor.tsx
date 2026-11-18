'use client';
import { useState } from 'react';
import { useRouter } from 'next/navigation';

interface M { id: string; label: string; dept: string; unit: string; better: string; agg: string; help: string }

function fyRestMonths(month: string) {
  const [y, m] = month.split('-').map(Number);
  const fyEndYear = m >= 4 ? y + 1 : y;
  const out: string[] = [];
  let yy = y, mm = m;
  while (!(yy === fyEndYear && mm > 3)) {
    mm++;
    if (mm > 12) { mm = 1; yy++; }
    if (yy === fyEndYear && mm > 3) break;
    out.push(`${yy}-${String(mm).padStart(2, '0')}`);
  }
  return out;
}

export default function TargetsEditor({ company, month, metrics, initial, canEdit }: { company: string; month: string; metrics: M[]; initial: Record<string, number>; canEdit: boolean }) {
  const router = useRouter();
  const [vals, setVals] = useState<Record<string, string>>(() => Object.fromEntries(Object.entries(initial).map(([k, v]) => [k, String(v)])));
  const [copy, setCopy] = useState(false);
  const [msg, setMsg] = useState('');
  const [busy, setBusy] = useState(false);

  const go = (c: string, m: string) => router.push(`/targets?company=${c}&month=${m}`);

  async function save() {
    setBusy(true);
    setMsg('');
    const values: Record<string, number | null> = {};
    for (const m of metrics) values[m.id] = vals[m.id] === undefined || vals[m.id] === '' ? null : Number(vals[m.id]);
    const res = await fetch('/api/targets', { method: 'PUT', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ company, month, values, copyToMonths: copy ? fyRestMonths(month) : [] }) });
    setBusy(false);
    const b = await res.json().catch(() => ({}));
    setMsg(res.ok ? `Saved ${b.saved} target values${copy ? ' (copied to the rest of the FY)' : ''}` : b.error || 'Save failed');
    if (res.ok) router.refresh();
  }

  const depts = Array.from(new Set(metrics.map((m) => m.dept)));
  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-end gap-3">
        <div>
          <label className="label" htmlFor="t-company">Company</label>
          <select id="t-company" className="input w-auto" value={company} onChange={(e) => go(e.target.value, month)}>
            {['All', 'Andreal', 'Anderson'].map((c) => <option key={c}>{c}</option>)}
          </select>
        </div>
        <div>
          <label className="label" htmlFor="t-month">Month</label>
          <input id="t-month" type="month" className="input w-auto" value={month} onChange={(e) => e.target.value && go(company, e.target.value)} />
        </div>
        {canEdit && (
          <>
            <label className="flex items-center gap-2 pb-2 text-sm text-gray-300">
              <input type="checkbox" checked={copy} onChange={(e) => setCopy(e.target.checked)} /> Also apply to the remaining months of this FY
            </label>
            <button className="btn-primary" onClick={save} disabled={busy}>{busy ? 'Saving…' : 'Save targets'}</button>
          </>
        )}
        {msg && <span className="pb-2 text-sm text-gray-300">{msg}</span>}
      </div>
      {!canEdit && <p className="text-xs text-rag-amber">Only admin / CEO can change targets.</p>}
      <div className="grid gap-4 lg:grid-cols-2">
        {depts.map((d) => (
          <div key={d} className="card card-pad">
            <h3 className="mb-2 text-sm font-medium text-white">{d}</h3>
            <table className="tbl">
              <tbody>
                {metrics.filter((m) => m.dept === d).map((m) => (
                  <tr key={m.id}>
                    <td className="whitespace-normal" title={m.help}>
                      <div className="text-gray-200">{m.label}</div>
                      <div className="text-[11px] text-gray-500">{m.better === 'higher' ? 'Higher is better' : 'Lower is better'} · {m.agg === 'sum' ? 'monthly total' : 'level'}</div>
                    </td>
                    <td className="w-44">
                      <div className="relative">
                        {m.unit === 'currency' && <span className="pointer-events-none absolute left-3 top-2 text-sm text-ink-500">₹</span>}
                        <input aria-label={`Target for ${m.label}`} type="number" step="any" disabled={!canEdit}
                          className={`input text-right ${m.unit === 'currency' ? 'pl-7' : ''}`}
                          value={vals[m.id] ?? ''} placeholder="—" onChange={(e) => setVals({ ...vals, [m.id]: e.target.value })} />
                        {m.unit === 'percent' && <span className="pointer-events-none absolute right-8 top-2 text-sm text-ink-500">%</span>}
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        ))}
      </div>
    </div>
  );
}
