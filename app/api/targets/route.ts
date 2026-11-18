import { withUser, json, fail } from '@/server/route-helpers';
import { canManageTargets } from '@/server/auth';
import { query, audit } from '@/db/client';
import { METRIC_BY_ID } from '@/config/metrics';
import { NextResponse } from 'next/server';

export async function GET(req: Request) {
  const user = await withUser(); if (user instanceof NextResponse) return user;
  const sp = new URL(req.url).searchParams;
  const rows = await query(`SELECT company, metric, month, value FROM targets WHERE company = $1 AND month = $2`, [sp.get('company') || 'All', sp.get('month') || '']);
  return json({ targets: rows });
}

/** Body: { company, month: 'YYYY-MM', values: { metricId: number | null }, copyToMonths?: string[] } */
export async function PUT(req: Request) {
  const user = await withUser(); if (user instanceof NextResponse) return user;
  if (!canManageTargets(user)) return fail('Only admin / CEO can set targets', 403);
  const b = await req.json().catch(() => null);
  if (!b || !/^\d{4}-\d{2}$/.test(b.month) || !['All', 'Andreal', 'Anderson'].includes(b.company)) return fail('company and month (YYYY-MM) required');
  const months: string[] = [b.month, ...(Array.isArray(b.copyToMonths) ? b.copyToMonths.filter((m: string) => /^\d{4}-\d{2}$/.test(m)) : [])];
  let n = 0;
  for (const month of months) {
    for (const [metric, raw] of Object.entries(b.values ?? {})) {
      if (!METRIC_BY_ID[metric]) continue;
      if (raw === null || raw === '' || raw === undefined) {
        await query(`DELETE FROM targets WHERE company=$1 AND metric=$2 AND month=$3`, [b.company, metric, month]);
        continue;
      }
      const v = Number(raw);
      if (!Number.isFinite(v)) continue;
      await query(
        `INSERT INTO targets (company, metric, month, value) VALUES ($1,$2,$3,$4)
         ON CONFLICT (company, metric, month) DO UPDATE SET value = EXCLUDED.value, updated_at = now()`,
        [b.company, metric, month, v],
      );
      n++;
    }
  }
  await audit(user.id, 'targets', null, null, { company: b.company, months, n });
  return json({ ok: true, saved: n });
}
