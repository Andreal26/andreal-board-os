import { requireUser } from '@/server/auth';
import { weeklyPack } from '@/server/weekly-pack';
import { DEPARTMENTS, DEPT_KEYS } from '@/config/departments';
import { EXECUTIVE_METRICS, METRIC_BY_ID } from '@/config/metrics';
import { vsTarget } from '@/lib/kpi-utils';
import { fmt, fmtDate } from '@/lib/format';
import { RagBadge, StatusBadge } from '@/components/dashboard/StatusBadges';
import PrintButton from '@/components/ui/PrintButton';

export default async function WeeklyPack() {
  const user = await requireUser();
  if (!['admin', 'ceo'].includes(user.role) && user.company !== 'All') return <p className="text-gray-400">The board pack is for admin / CEO.</p>;
  const { board, prev, alerts } = await weeklyPack();
  const decisions = DEPT_KEYS.map((d) => ({ d, n: board.notes[d] })).filter((x) => x.n?.decision_needed);
  return (
    <div className="print-dark-text mx-auto max-w-5xl space-y-6">
      <div className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <div className="kicker">Weekly board pack</div>
          <h1 className="h-display mt-1 text-3xl">Andreal + Anderson — {fmtDate(new Date().toISOString())}</h1>
          <p className="text-sm text-gray-400">{board.period.label} · change vs {prev ? `snapshot of ${fmtDate(prev.date)}` : 'last week (no snapshot yet)'}</p>
        </div>
        <PrintButton />
      </div>

      <section className="card card-pad">
        <h2 className="mb-3 text-sm font-medium text-white">1 · Department health</h2>
        <div className="-mx-1 overflow-x-auto px-1"><table className="tbl">
          <tbody>
            {DEPT_KEYS.map((d) => (
              <tr key={d}>
                <td className="font-medium">{DEPARTMENTS[d].name}</td>
                <td><RagBadge rag={board.health[d].rag} /></td>
                <td className="whitespace-normal text-gray-400">{board.health[d].reason}</td>
                <td className="whitespace-normal text-xs">{board.notes[d]?.major_risk ?? ''}</td>
              </tr>
            ))}
          </tbody>
        </table></div>
      </section>

      <section className="card card-pad">
        <h2 className="mb-3 text-sm font-medium text-white">2 · Decisions needed from the board</h2>
        {decisions.length ? (
          <ul className="space-y-2 text-sm">
            {decisions.map(({ d, n }) => (
              <li key={d}><b className="text-coral-400">{DEPARTMENTS[d].name}:</b> {n!.decision_needed} <span className="text-gray-500">— {n!.owner || 'no owner'}{n!.deadline ? `, by ${n!.deadline}` : ''}</span></li>
            ))}
          </ul>
        ) : <p className="text-sm text-ink-500">No decisions logged on the Department Summary.</p>}
      </section>

      <section className="card card-pad">
        <h2 className="mb-3 text-sm font-medium text-white">3 · Key numbers</h2>
        <div className="-mx-1 overflow-x-auto px-1"><table className="tbl">
          <thead><tr><th>Metric</th><th className="text-right">Actual</th><th className="text-right">Target</th><th>Status</th><th className="text-right">Δ vs last week</th></tr></thead>
          <tbody>
            {EXECUTIVE_METRICS.map((id) => {
              const m = METRIC_BY_ID[id];
              const v = board.kpis[id];
              const t = board.targets[id];
              const before = prev?.metrics?.[id];
              const delta = v !== null && before !== null && before !== undefined ? v - before : null;
              return (
                <tr key={id}>
                  <td><span className="text-gray-500">{DEPARTMENTS[m.dept].short} · </span>{m.label}</td>
                  <td className="text-right tabular-nums">{fmt(v, m.unit)}</td>
                  <td className="text-right tabular-nums text-gray-400">{t !== undefined ? fmt(t, m.unit) : '—'}</td>
                  <td><StatusBadge status={vsTarget(m, v, t).status} /></td>
                  <td className="text-right tabular-nums text-gray-400">{delta === null ? '—' : `${delta > 0 ? '+' : ''}${fmt(delta, m.unit)}`}</td>
                </tr>
              );
            })}
          </tbody>
        </table></div>
      </section>

      <section className="card card-pad">
        <h2 className="mb-3 text-sm font-medium text-white">4 · Exceptions ({alerts.length} open, {alerts.filter((a) => a.severity === 'high').length} high)</h2>
        <ul className="space-y-1 text-sm">
          {alerts.filter((a) => a.severity !== 'low').slice(0, 25).map((a, i) => (
            <li key={i}><span className={a.severity === 'high' ? 'text-rag-red' : 'text-rag-amber'}>{a.severity === 'high' ? '■' : '▲'}</span> <b>{DEPARTMENTS[a.dept].short}</b> · {a.title} — <span className="text-gray-400">{a.message}</span></li>
          ))}
          {!alerts.length && <li className="text-ink-500">None.</li>}
        </ul>
      </section>
    </div>
  );
}
