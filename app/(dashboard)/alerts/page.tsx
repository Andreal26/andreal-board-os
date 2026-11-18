import Link from 'next/link';
import { requireUser, canViewDept } from '@/server/auth';
import { evaluateAlerts } from '@/server/alerts';
import { query } from '@/db/client';
import { DEPARTMENTS } from '@/config/departments';
import RunJobButton from '@/components/admin/RunJobButton';

const SEV = { high: 'border-rag-red/50 text-rag-red', medium: 'border-rag-amber/50 text-rag-amber', low: 'border-ink-600 text-gray-400' };
const ICON = { high: '■', medium: '▲', low: '●' };

export default async function AlertsPage({ searchParams }: { searchParams: Promise<{ dept?: string; sev?: string }> }) {
  const user = await requireUser();
  const sp = await searchParams;
  const all = (await evaluateAlerts()).filter((a) => canViewDept(user, a.dept) && (user.company === 'All' || a.company === user.company));
  const alerts = all.filter((a) => (!sp.dept || a.dept === sp.dept) && (!sp.sev || a.severity === sp.sev));
  const [last] = await query<{ run_at: string }>(`SELECT max(run_at) AS run_at FROM alert_log`);
  const counts = { high: all.filter((a) => a.severity === 'high').length, medium: all.filter((a) => a.severity === 'medium').length, low: all.filter((a) => a.severity === 'low').length };
  const link = (k: string, v?: string) => {
    const q = new URLSearchParams({ ...(sp.dept ? { dept: sp.dept } : {}), ...(sp.sev ? { sev: sp.sev } : {}) });
    if (v) q.set(k, v); else q.delete(k);
    return `/alerts?${q}`;
  };
  return (
    <div className="space-y-5">
      <div className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <div className="kicker">Exception control</div>
          <h1 className="h-display mt-1 text-3xl">Alerts</h1>
          <p className="mt-1 text-sm text-gray-400">Live from current data. The daily digest emails these to the board and each department owner{last?.run_at ? ` · last digest ${new Date(last.run_at).toLocaleString('en-GB')}` : ''}.</p>
        </div>
        {user.role === 'admin' && <RunJobButton job="alerts" label="Send digest now" />}
      </div>
      <div className="flex flex-wrap gap-2 text-sm">
        <Link className={`btn-ghost ${!sp.sev ? 'border-teal-500' : ''}`} href={link('sev')}>All ({all.length})</Link>
        {(['high', 'medium', 'low'] as const).map((s) => (
          <Link key={s} className={`btn-ghost ${sp.sev === s ? 'border-teal-500' : ''}`} href={link('sev', s)}>{s} ({counts[s]})</Link>
        ))}
        <span className="mx-2 border-l border-ink-700" />
        <Link className={`btn-ghost ${!sp.dept ? 'border-teal-500' : ''}`} href={link('dept')}>All departments</Link>
        {Object.values(DEPARTMENTS).filter((d) => canViewDept(user, d.key)).map((d) => (
          <Link key={d.key} className={`btn-ghost ${sp.dept === d.key ? 'border-teal-500' : ''}`} href={link('dept', d.key)}>{d.short}</Link>
        ))}
      </div>
      <div className="space-y-2">
        {alerts.map((a, i) => (
          <Link key={i} href={`/d/${a.dept}/${a.recordId}`} className={`card flex items-start gap-3 border-l-4 p-3 transition hover:bg-ink-800 ${SEV[a.severity]}`} style={{ borderRadius: 0 }}>
            <span className="mt-0.5 text-xs" aria-hidden>{ICON[a.severity]}</span>
            <div className="min-w-0 flex-1">
              <div className="text-sm text-white">{a.title} <span className="text-xs text-gray-500">· {DEPARTMENTS[a.dept].name} · {a.company}</span></div>
              <div className="text-sm text-gray-300">{a.message}</div>
            </div>
            <div className="text-right text-xs">
              <div className="uppercase">{a.severity}</div>
              {a.owner && <div className="text-gray-500">{a.owner}</div>}
            </div>
          </Link>
        ))}
        {!alerts.length && <div className="card card-pad text-center text-sm text-ink-500">No alerts — everything within limits.</div>}
      </div>
    </div>
  );
}
