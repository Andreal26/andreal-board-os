import Link from 'next/link';
import { requireUser, scopeCompany, canViewDept, canEditDeptNotes } from '@/server/auth';
import { getBoard } from '@/server/board';
import { DEPARTMENTS, DEPT_KEYS } from '@/config/departments';
import { DEPT_KEY_KPIS, METRIC_BY_ID } from '@/config/metrics';
import { vsTarget } from '@/lib/kpi-utils';
import { fmt } from '@/lib/format';
import FilterBar from '@/components/layout/FilterBar';
import { RagBadge, statusText } from '@/components/dashboard/StatusBadges';
import DeptNotesEditor from '@/components/dashboard/DeptNotesEditor';

type SP = Promise<{ company?: string; period?: string }>;

export default async function DepartmentSummary({ searchParams }: { searchParams: SP }) {
  const user = await requireUser();
  const sp = await searchParams;
  const company = scopeCompany(user, sp.company);
  const board = await getBoard(company, sp.period);
  const depts = DEPT_KEYS.filter((d) => canViewDept(user, d));

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <div className="kicker">Department summary</div>
          <h1 className="h-display mt-1 text-3xl">Health, risk & decisions</h1>
          <p className="mt-1 text-sm text-gray-400">Weekly review. Health is calculated; risk, decision, owner and deadline are written by the department owner.</p>
        </div>
        <FilterBar company={company} period={board.period.key} lockCompany={user.company !== 'All'} />
      </div>

      <div className="card overflow-x-auto">
        <table className="tbl">
          <thead>
            <tr>
              <th>Department</th><th>Health</th><th>Key KPI 1</th><th>Key KPI 2</th><th>Key KPI 3</th><th>Major risk</th><th>Decision needed</th><th>Owner</th><th>Deadline</th>
            </tr>
          </thead>
          <tbody>
            {depts.map((d) => {
              const n = board.notes[d];
              return (
                <tr key={d}>
                  <td><Link className="font-medium text-white hover:text-teal-300" href={`/d/${d}`}>{DEPARTMENTS[d].name}</Link></td>
                  <td><RagBadge rag={board.health[d].rag} /><div className="mt-1 text-[11px] text-gray-500">{board.health[d].reason}</div></td>
                  {DEPT_KEY_KPIS[d].map((id) => {
                    const m = METRIC_BY_ID[id];
                    const st = vsTarget(m, board.kpis[id], board.targets[id]).status;
                    return (
                      <td key={id}>
                        <div className="text-[11px] text-gray-500">{m.label}</div>
                        <div className={`font-medium ${statusText(st)}`}>{fmt(board.kpis[id], m.unit)}</div>
                      </td>
                    );
                  })}
                  <td className="max-w-[220px] whitespace-normal text-xs">{n?.major_risk || <span className="text-ink-500">—</span>}</td>
                  <td className="max-w-[220px] whitespace-normal text-xs text-coral-300">{n?.decision_needed || <span className="text-ink-500">—</span>}</td>
                  <td className="text-xs">{n?.owner || '—'}</td>
                  <td className="text-xs">{n?.deadline || '—'}</td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>

      <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
        {depts.map((d) => (
          <DeptNotesEditor key={d} dept={d} name={DEPARTMENTS[d].name} note={board.notes[d] ?? null} canEdit={canEditDeptNotes(user, d)} />
        ))}
      </div>

      <div className="card card-pad text-xs text-gray-400">
        <h3 className="mb-2 text-sm font-medium text-white">How health is decided</h3>
        <ul className="grid gap-1 md:grid-cols-2">
          <li><b className="text-gray-200">Operations</b> — Green with no delayed/at-risk jobs, Amber 1–2, Red 3+.</li>
          <li><b className="text-gray-200">Sales</b> — Red with no weighted pipeline, Amber below target (default ₹5 L) or 5+ overdue follow-ups.</li>
          <li><b className="text-gray-200">Marketing</b> — Red with no leads, Amber with no MQLs or CPL above target (default ₹450).</li>
          <li><b className="text-gray-200">HR</b> — Red below 50% utilisation, Amber below 75% or any high attrition risk.</li>
          <li><b className="text-gray-200">Cashflow</b> — Red when net cashflow is negative, Amber with 90+ day receivables or net below ₹2 L.</li>
          <li><b className="text-gray-200">R&amp;D</b> — Amber with a blocker or no client pilot.</li>
        </ul>
        <p className="mt-2">A department with no records shows <b>No data</b> instead of a misleading colour. Thresholds live in <code>config/health.ts</code>.</p>
      </div>
    </div>
  );
}
