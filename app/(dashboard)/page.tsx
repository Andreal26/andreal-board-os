import Link from 'next/link';
import { requireUser, scopeCompany, canViewDept } from '@/server/auth';
import { getBoard } from '@/server/board';
import { snapshotFrom } from '@/server/snapshots';
import { DEPARTMENTS, DEPT_KEYS, type DeptKey } from '@/config/departments';
import { EXECUTIVE_METRICS, METRIC_BY_ID } from '@/config/metrics';
import { fyLabel, today } from '@/lib/periods';
import { fmtDate } from '@/lib/format';
import FilterBar from '@/components/layout/FilterBar';
import KpiCard from '@/components/dashboard/KpiCard';
import { RagBadge, StatusBadge } from '@/components/dashboard/StatusBadges';
import { AgeingChart, CashChart, FunnelChart, OpsChart, PipelineChart } from '@/components/charts/BoardCharts';

type SP = Promise<{ company?: string; period?: string }>;

export default async function ExecutiveSummary({ searchParams }: { searchParams: SP }) {
  const user = await requireUser();
  const sp = await searchParams;
  const company = scopeCompany(user, sp.company);
  const board = await getBoard(company, sp.period);
  const prev = await snapshotFrom(company, 7);
  const visible = (id: string) => canViewDept(user, METRIC_BY_ID[id].dept);

  const groups: { dept: DeptKey; ids: string[] }[] = DEPT_KEYS.map((d) => ({ dept: d, ids: EXECUTIVE_METRICS.filter((id) => METRIC_BY_ID[id].dept === d && visible(id)) })).filter((g) => g.ids.length);

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <div className="kicker">Executive summary · {fyLabel(today())}</div>
          <h1 className="h-display mt-1 text-3xl">CEO / Controller / Board view</h1>
          <p className="mt-1 text-sm text-gray-400">
            {board.period.label} ({fmtDate(board.period.start)} – {fmtDate(board.period.end)}) · {company === 'All' ? 'Andreal + Anderson' : company}
          </p>
        </div>
        <FilterBar company={company} period={board.period.key} lockCompany={user.company !== 'All'} />
      </div>

      <section className="grid items-start gap-4 lg:grid-cols-3">
        <div className="card card-pad lg:col-span-2">
          <h2 className="mb-3 text-sm font-medium text-white">Department health</h2>
          <div className="grid gap-2 sm:grid-cols-2 xl:grid-cols-3">
            {DEPT_KEYS.filter((d) => canViewDept(user, d)).map((d) => (
              <Link key={d} href={`/d/${d}`} className="rounded-lg border border-ink-700 bg-ink-900 p-3 transition hover:border-ink-500">
                <div className="flex items-center justify-between gap-2">
                  <span className="text-sm font-medium text-gray-100">{DEPARTMENTS[d].name}</span>
                  <RagBadge rag={board.health[d].rag} />
                </div>
                <p className="mt-1 text-xs text-gray-400">{board.health[d].reason}</p>
                {board.notes[d]?.decision_needed && <p className="mt-1 text-xs text-coral-400">Decision: {board.notes[d].decision_needed}</p>}
              </Link>
            ))}
          </div>
        </div>
        <div className="card card-pad">
          <h2 className="mb-3 text-sm font-medium text-white">CEO control questions</h2>
          <ol className="space-y-3">
            {board.questions.map((q, i) => (
              <li key={i} className="flex gap-3 text-sm">
                <span className="mt-0.5 font-display text-teal-400">{i + 1}</span>
                <div className="flex-1">
                  <p className="text-gray-200">{q.q}</p>
                  <div className="mt-1 flex items-center gap-2">
                    <StatusBadge status={q.status} label={q.status === 'good' ? 'Yes' : q.status === 'watch' ? 'Watch' : q.status === 'bad' ? 'No — act' : 'Not enough data'} />
                    {'detail' in q && q.detail && <span className="text-xs text-gray-500">{q.detail}</span>}
                  </div>
                </div>
              </li>
            ))}
          </ol>
        </div>
      </section>

      {groups.map((g) => (
        <section key={g.dept}>
          <div className="mb-2 flex items-center gap-3">
            <h2 className="text-xs font-medium uppercase tracking-wider text-gray-400">{DEPARTMENTS[g.dept].name}</h2>
            <div className="h-px flex-1 bg-ink-700" />
          </div>
          <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
            {g.ids.map((id) => (
              <KpiCard key={id} id={id} value={board.kpis[id]} target={board.targets[id]} prev={prev?.metrics?.[id]} />
            ))}
          </div>
        </section>
      ))}

      <section className="grid gap-4 lg:grid-cols-2">
        <PipelineChart data={board.charts.pipeline} />
        <FunnelChart data={board.charts.funnel} />
        <CashChart data={board.charts.cash} />
        <AgeingChart data={board.charts.ageing} />
        <OpsChart data={board.charts.ops} />
        <div className="card card-pad">
          <h3 className="mb-3 text-sm font-medium text-white">Marketing efficiency by channel</h3>
          {board.charts.funnel.length ? (
            <div className="-mx-1 overflow-x-auto px-1"><table className="tbl">
              <thead><tr><th>Channel</th><th className="text-right">Spend</th><th className="text-right">Leads</th><th className="text-right">CPL</th><th className="text-right">MQL</th></tr></thead>
              <tbody>
                {board.charts.funnel.map((r) => (
                  <tr key={r.channel}>
                    <td>{r.channel}</td>
                    <td className="text-right">₹{Math.round(r.spend).toLocaleString('en-IN')}</td>
                    <td className="text-right">{r.leads}</td>
                    <td className="text-right">{r.cpl === null ? '—' : `₹${r.cpl.toLocaleString('en-IN')}`}</td>
                    <td className="text-right">{r.mql}</td>
                  </tr>
                ))}
              </tbody>
            </table></div>
          ) : <p className="text-sm text-ink-500">No campaigns in this period.</p>}
        </div>
      </section>
    </div>
  );
}
