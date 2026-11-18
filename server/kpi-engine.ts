import { query } from '@/db/client';
import { HEALTH_RULES } from '@/config/health';
import { METRICS, METRIC_BY_ID, sum, salesOpen } from '@/config/metrics';
import { fmtLakh, round } from '@/lib/utils';
import { inPeriod, monthsIn, shiftMonth, currentMonth } from '@/lib/periods';
import { vsTarget } from '@/lib/kpi-utils';
import type { BoardData as Data, CompanyFilter, DeptKey, KpiValues, Period, Rag, Status } from '@/types';

/**
 * KPI engine: evaluates the metric definitions (config/metrics.ts) for a company + period,
 * loads targets, decides department health and answers the CEO control questions.
 */

export function computeAll(d: Data, p: Period): KpiValues {
  const out: KpiValues = {};
  for (const m of METRICS) {
    try {
      out[m.id] = m.compute(d, p);
    } catch {
      out[m.id] = null;
    }
  }
  return out;
}

// ── Targets ─────────────────────────────────────────────────
export async function loadTargets(company: CompanyFilter, p: Period): Promise<KpiValues> {
  const months = monthsIn(p);
  const out: KpiValues = {};
  if (!months.length) return out;
  const rows = await query<{ company: string; metric: string; month: string; value: number }>(
    `SELECT company, metric, month, value FROM targets WHERE month IN (SELECT jsonb_array_elements_text($1::jsonb))`,
    [JSON.stringify(months.map((m) => m.month))],
  );
  for (const m of METRICS) {
    const pick = (co: string) => rows.filter((r) => r.metric === m.id && r.company === co);
    let mine = pick(company);
    if (!mine.length && company === 'All') mine = [...pick('Andreal'), ...pick('Anderson')];
    if (!mine.length) continue;
    if (m.agg === 'sum') {
      let total = 0;
      for (const mo of months) {
        const v = mine.filter((r) => r.month === mo.month).reduce((a, r) => a + Number(r.value), 0);
        total += v * mo.fraction;
      }
      out[m.id] = round(total, 0);
    } else {
      // average per month; for All with company-split targets, sum stocks across companies first
      const byMonth = new Map<string, number[]>();
      for (const r of mine) byMonth.set(r.month, [...(byMonth.get(r.month) ?? []), Number(r.value)]);
      const perMonth = Array.from(byMonth.values()).map((vals) =>
        company === 'All' && m.kind === 'stock' && m.unit !== 'percent' ? vals.reduce((a, b) => a + b, 0) : vals.reduce((a, b) => a + b, 0) / vals.length,
      );
      out[m.id] = round(perMonth.reduce((a, b) => a + b, 0) / perMonth.length, 1);
    }
  }
  return out;
}

// ── Department health (RAG) ─────────────────────────────────
export function deptHealth(dept: DeptKey, d: Data, k: KpiValues, t: KpiValues): { rag: Rag; reason: string } {
  const rows = d[dept];
  if (!rows.length) return { rag: 'No data', reason: 'No records entered yet' };
  const R = HEALTH_RULES;
  switch (dept) {
    case 'operations': {
      const n = k.ops_delayed_jobs ?? 0;
      if (n >= R.operations.redDelayed) return { rag: 'Red', reason: `${n} delayed / at-risk jobs` };
      if (n >= R.operations.amberDelayed) return { rag: 'Amber', reason: `${n} delayed / at-risk job${n > 1 ? 's' : ''}` };
      return { rag: 'Green', reason: 'No delayed jobs' };
    }
    case 'sales': {
      const wp = k.sales_weighted_pipeline ?? 0;
      const target = t.sales_weighted_pipeline ?? R.sales.amberWeightedPipeline;
      if (wp <= 0) return { rag: 'Red', reason: 'No weighted pipeline' };
      if (wp < target) return { rag: 'Amber', reason: `Weighted pipeline below ₹${fmtLakh(target)}` };
      if ((k.sales_overdue_followups ?? 0) > 5) return { rag: 'Amber', reason: `${k.sales_overdue_followups} overdue follow-ups` };
      return { rag: 'Green', reason: 'Pipeline healthy' };
    }
    case 'marketing': {
      const leads = k.mkt_leads ?? 0, mql = k.mkt_mql ?? 0, cpl = k.mkt_cpl;
      const maxCpl = t.mkt_cpl ?? R.marketing.maxCpl;
      if (!leads) return { rag: 'Red', reason: 'No leads in period' };
      if (!mql) return { rag: 'Amber', reason: 'Leads but no MQLs' };
      if (cpl !== null && cpl > maxCpl) return { rag: 'Amber', reason: `CPL ₹${cpl} above ₹${maxCpl}` };
      return { rag: 'Green', reason: 'Funnel moving within CPL' };
    }
    case 'hr': {
      const u = k.hr_utilization;
      if (u === null) return { rag: 'No data', reason: 'Utilisation not entered' };
      if (u < R.hr.redUtil) return { rag: 'Red', reason: `Utilisation ${u}%` };
      if (u < R.hr.amberUtil) return { rag: 'Amber', reason: `Utilisation ${u}%` };
      if ((k.hr_attrition_risk ?? 0) > 0) return { rag: 'Amber', reason: `${k.hr_attrition_risk} high attrition risk` };
      return { rag: 'Green', reason: `Utilisation ${u}%` };
    }
    case 'cashflow': {
      const net = k.cash_net ?? 0;
      if (net < 0) return { rag: 'Red', reason: 'Negative net cashflow' };
      if ((k.cash_receivables_90 ?? 0) > 0) return { rag: 'Amber', reason: `₹${fmtLakh(k.cash_receivables_90 ?? 0)} stuck above 90 days` };
      if (net < R.cashflow.amberNet) return { rag: 'Amber', reason: 'Net cashflow below ₹2 L' };
      return { rag: 'Green', reason: 'Cash positive' };
    }
    case 'rnd': {
      if ((k.rnd_blocked ?? 0) > 0) return { rag: 'Amber', reason: `${k.rnd_blocked} blocked initiative(s)` };
      if (!(k.rnd_pilots ?? 0)) return { rag: 'Amber', reason: 'No client pilot identified' };
      return { rag: 'Green', reason: 'Progressing with pilots' };
    }
  }
}

// ── CEO control questions ────────────────────────────────────
export function ceoQuestions(k: KpiValues, t: KpiValues, health: Record<DeptKey, { rag: Rag }>) {
  const s = (ok: boolean | null): Status => (ok === null ? 'none' : ok ? 'good' : 'bad');
  const cmp = (id: string) => {
    const m = METRIC_BY_ID[id];
    return vsTarget(m, k[id], t[id]).status;
  };
  const worst = (...st: Status[]): Status => (st.includes('bad') ? 'bad' : st.includes('watch') ? 'watch' : st.every((x) => x === 'none') ? 'none' : 'good');
  const reds = (Object.entries(health) as [DeptKey, { rag: Rag }][]).filter(([, h]) => h.rag === 'Red').map(([d]) => d);
  return [
    { q: 'Are we creating enough revenue and pipeline?', status: worst(cmp('sales_weighted_pipeline'), cmp('sales_won_value'), health.sales.rag === 'Red' ? 'bad' : 'none') },
    { q: 'Are we collecting enough cash against expenses?', status: worst(cmp('cash_collections'), s(k.cash_net === null ? null : (k.cash_net ?? 0) >= 0), (k.cash_receivables_90 ?? 0) > 0 ? 'watch' : 'none') },
    { q: 'Are projects / jobs moving on time with acceptable contribution?', status: worst(s((k.ops_delayed_jobs ?? 0) === 0), cmp('ops_contribution_pct')) },
    { q: 'Are people being utilised productively?', status: vsTarget(METRIC_BY_ID.hr_utilization, k.hr_utilization, t.hr_utilization ?? 75).status },
    { q: 'Which risks need CEO / Board intervention now?', status: reds.length ? ('bad' as Status) : ('good' as Status), detail: reds.length ? `Red: ${reds.join(', ')}` : 'No department in Red' },
  ];
}

// ── Chart data ───────────────────────────────────────────────
export function chartData(d: Data, p: Period) {
  const stages = ['New', 'Contacted', 'Discovery', 'Proposal', 'Negotiation'];
  const pipeline = stages.map((stage) => {
    const rows = d.sales.filter((r) => salesOpen(r) && r.stage === stage);
    return { stage, value: sum(rows, 'expectedValue'), weighted: sum(rows, 'weightedValue'), count: rows.length };
  });

  const channels = Array.from(new Set(d.marketing.map((r) => r.channel).filter(Boolean)));
  const funnel = channels.map((channel) => {
    const rows = d.marketing.filter((r) => r.channel === channel && inPeriod(r.startDate, p));
    const spend = sum(rows, 'actualSpend'), leads = sum(rows, 'leads');
    return { channel, spend, leads, mql: sum(rows, 'mql'), sql: sum(rows, 'sql'), cpl: leads ? Math.round(spend / leads) : null };
  }).filter((r) => r.spend || r.leads);

  const cm = currentMonth();
  const cash = Array.from({ length: 6 }, (_, i) => shiftMonth(cm, i - 5)).map((month) => {
    const rows = d.cashflow.filter((r) => String(r.entryDate ?? '').startsWith(month));
    const collections = sum(rows, 'actualCollections'), payments = sum(rows, 'actualPayment');
    return { month, collections, payments, net: collections - payments };
  });

  const ageing = [
    { bucket: '0–30 d', value: sum(d.cashflow, 'rec0_30') },
    { bucket: '31–60 d', value: sum(d.cashflow, 'rec31_60') },
    { bucket: '61–90 d', value: sum(d.cashflow, 'rec61_90') },
    { bucket: '90+ d', value: sum(d.cashflow, 'rec90plus') },
  ];

  const statuses = ['On Track', 'At Risk', 'Delayed'];
  const ops = statuses.map((status) => {
    const rows = d.operations.filter((r) => r.deliveryStatus === status);
    return { status, count: rows.length, value: sum(rows, 'jobValue') };
  });

  const sourceMap = new Map<string, number>();
  for (const r of d.sales.filter((r) => inPeriod(r.leadDate, p))) {
    const k = r.leadSource || 'Unknown';
    sourceMap.set(k, (sourceMap.get(k) ?? 0) + 1);
  }
  const sources = Array.from(sourceMap, ([source, count]) => ({ source, count })).sort((a, b) => b.count - a.count);

  return { pipeline, funnel, cash, ageing, ops, sources };
}
