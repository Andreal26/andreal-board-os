import { query } from '@/db/client';
import { loadAll } from '@/server/records';
import { computeAll } from '@/server/kpi-engine';
import { type KpiValues } from '@/types';
import { resolvePeriod, today } from '@/lib/periods';
import { COMPANY_FILTER, type CompanyFilter } from '@/config/lists';

/**
 * Daily snapshot of every KPI (MTD view) per company, so the board can see trends
 * and week-on-week change — the live tables only ever show "now".
 */
export async function takeSnapshot() {
  const date = today().toISOString().slice(0, 10);
  const p = resolvePeriod('MTD');
  for (const company of COMPANY_FILTER) {
    const data = await loadAll(company);
    const metrics = computeAll(data, p);
    await query(
      `INSERT INTO snapshots (snap_date, company, metrics) VALUES ($1, $2, $3::jsonb)
       ON CONFLICT (snap_date, company) DO UPDATE SET metrics = EXCLUDED.metrics, created_at = now()`,
      [date, company, JSON.stringify(metrics)],
    );
  }
  return { date };
}

/** Snapshot closest to (on or before) `daysAgo` days back. */
export async function snapshotFrom(company: CompanyFilter, daysAgo: number): Promise<{ date: string; metrics: KpiValues } | null> {
  const d = new Date(today().getTime() - daysAgo * 86400000).toISOString().slice(0, 10);
  const rows = await query<{ snap_date: string | Date; metrics: KpiValues }>(
    `SELECT snap_date, metrics FROM snapshots WHERE company = $1 AND snap_date <= $2 ORDER BY snap_date DESC LIMIT 1`,
    [company, d],
  );
  if (!rows[0]) return null;
  const sd = rows[0].snap_date;
  return { date: sd instanceof Date ? sd.toISOString().slice(0, 10) : String(sd).slice(0, 10), metrics: rows[0].metrics };
}

export async function history(company: CompanyFilter, metric: string, days = 90) {
  const rows = await query<{ snap_date: string | Date; v: number | null }>(
    `SELECT snap_date, (metrics->>$2)::float AS v FROM snapshots
     WHERE company = $1 AND snap_date >= (CURRENT_DATE - $3::int) ORDER BY snap_date`,
    [company, metric, days],
  );
  return rows.map((r) => ({ date: r.snap_date instanceof Date ? r.snap_date.toISOString().slice(0, 10) : String(r.snap_date).slice(0, 10), v: r.v }));
}
