import { requireUser, canManageTargets } from '@/server/auth';
import { query } from '@/db/client';
import { METRICS } from '@/config/metrics';
import { DEPARTMENTS } from '@/config/departments';
import { currentMonth } from '@/lib/periods';
import TargetsEditor from '@/components/targets/TargetsEditor';

type SP = Promise<{ company?: string; month?: string }>;

export default async function TargetsPage({ searchParams }: { searchParams: SP }) {
  const user = await requireUser();
  const sp = await searchParams;
  const company = ['All', 'Andreal', 'Anderson'].includes(sp.company ?? '') ? sp.company! : 'All';
  const month = /^\d{4}-\d{2}$/.test(sp.month ?? '') ? sp.month! : currentMonth();
  const rows = await query<{ metric: string; value: number }>(`SELECT metric, value FROM targets WHERE company = $1 AND month = $2`, [company, month]);
  const values = Object.fromEntries(rows.map((r) => [r.metric, r.value]));
  const metrics = METRICS.map((m) => ({ id: m.id, label: m.label, dept: DEPARTMENTS[m.dept].name, unit: m.unit, better: m.better, agg: m.agg, help: m.help }));
  return (
    <div className="space-y-5">
      <div>
        <div className="kicker">Control</div>
        <h1 className="h-display mt-1 text-3xl">Monthly targets</h1>
        <p className="mt-1 max-w-3xl text-sm text-gray-400">
          Set a target per metric per month, for both companies together (All) or each company. Flow metrics (spend, leads, collections) are summed and
          pro-rated over the selected period; stock and ratio metrics (pipeline, CPL, utilisation) are averaged. If no &quot;All&quot; target exists, the
          Andreal + Anderson targets are combined.
        </p>
      </div>
      <TargetsEditor company={company} month={month} metrics={metrics} initial={values} canEdit={canManageTargets(user)} />
    </div>
  );
}
