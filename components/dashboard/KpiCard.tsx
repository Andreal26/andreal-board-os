import { METRIC_BY_ID } from '@/config/metrics';
import { vsTarget } from '@/lib/kpi-utils';
import { fmt } from '@/lib/format';
import { StatusBadge, statusText } from '@/components/dashboard/StatusBadges';

export default function KpiCard({ id, value, target, prev }: { id: string; value: number | null; target?: number | null; prev?: number | null }) {
  const m = METRIC_BY_ID[id];
  const vt = vsTarget(m, value, target);
  const delta = value !== null && prev !== null && prev !== undefined ? value - prev : null;
  const deltaGood = delta === null || delta === 0 ? null : (delta > 0) === (m.better === 'higher');
  return (
    <div className="card card-pad flex flex-col gap-1" title={m.help}>
      <div className="flex items-start justify-between gap-2">
        <div className="text-xs text-gray-400">{m.label}</div>
        <span className="text-[10px] uppercase tracking-wide text-ink-500">{m.kind === 'stock' ? 'now' : 'period'}</span>
      </div>
      <div className={`font-display text-2xl font-extrabold ${statusText(vt.status)}`}>{fmt(value, m.unit)}</div>
      <div className="flex flex-wrap items-center gap-2 text-xs text-gray-400">
        {target !== undefined && target !== null ? (
          <>
            <span>Target {fmt(target, m.unit)}</span>
            <StatusBadge status={vt.status} label={vt.attainment !== null ? `${vt.attainment}%` : undefined} />
          </>
        ) : (
          <span className="text-ink-500">No target set</span>
        )}
        {delta !== null && delta !== 0 && (
          <span className={deltaGood ? 'text-rag-green' : 'text-rag-red'}>
            {delta > 0 ? '▲' : '▼'} {fmt(Math.abs(delta), m.unit)} vs 7d
          </span>
        )}
      </div>
    </div>
  );
}
