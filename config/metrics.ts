import { n0, num, round, todayUTC } from '@/lib/utils';
import { inPeriod } from '@/lib/periods';
import type { DeptKey, Metric, RecordData } from '@/types';

/**
 * KPI definitions. Every board number is defined once here with its unit, direction and
 * whether it is a flow (counted inside the selected period) or a stock (current state).
 * The engine that evaluates them lives in server/kpi-engine.ts.
 */
export type { Metric } from '@/types';

export const sum = (rows: RecordData[], k: string) => rows.reduce((a, r) => a + n0(r[k]), 0);
export const avg = (rows: RecordData[], k: string) => {
  const vals = rows.map((r) => num(r[k])).filter((v): v is number => v !== null);
  return vals.length ? round(vals.reduce((a, b) => a + b, 0) / vals.length, 1) : null;
};
const div = (a: number, b: number, pct = false) => (b ? round((a / b) * (pct ? 100 : 1), pct ? 1 : 0) : null);
const todayStr = () => todayUTC().toISOString().slice(0, 10);

// Row filters (shared with alert rules)
export const opsActive = (r: RecordData) => !['Delivered', 'Closed'].includes(r.deliveryStatus);
export const opsAtRisk = (r: RecordData) => opsActive(r) && ['Delayed', 'At Risk'].includes(r.deliveryStatus);
export const salesOpen = (r: RecordData) => (r.dealStatus ?? 'Open') === 'Open';
export const hrActive = (r: RecordData) => ['Active', 'Probation', 'Notice'].includes(r.employmentStatus);
export const rndActive = (r: RecordData) => !['Launch', 'Paused'].includes(r.stage);
const isPast = (d: unknown) => !!d && String(d).slice(0, 10) < todayStr();

export const METRICS: Metric[] = [
  // ── Operations
  { id: 'ops_active_jobs', label: 'Active projects / jobs', dept: 'operations', unit: 'count', kind: 'stock', better: 'higher', agg: 'avg',
    help: 'Jobs not yet Delivered or Closed.', compute: (d) => d.operations.filter(opsActive).length },
  { id: 'ops_delayed_jobs', label: 'Delayed / at-risk jobs', dept: 'operations', unit: 'count', kind: 'stock', better: 'lower', agg: 'avg',
    help: 'Open jobs marked Delayed or At Risk. Escalate if rising.', compute: (d) => d.operations.filter(opsAtRisk).length },
  { id: 'ops_wip_value', label: 'Work-in-progress value', dept: 'operations', unit: 'currency', kind: 'stock', better: 'higher', agg: 'avg',
    help: 'Job value of all open jobs.', compute: (d) => sum(d.operations.filter(opsActive), 'jobValue') },
  { id: 'ops_gross_contribution', label: 'Gross contribution', dept: 'operations', unit: 'currency', kind: 'flow', better: 'higher', agg: 'sum',
    help: 'Job value − actual cost − outwork, for jobs started in the period.',
    compute: (d, p) => sum(d.operations.filter((r) => inPeriod(r.startDate, p)), 'grossContribution') },
  { id: 'ops_contribution_pct', label: 'Gross contribution %', dept: 'operations', unit: 'percent', kind: 'flow', better: 'higher', agg: 'avg',
    help: 'Revenue quality after direct cost.',
    compute: (d, p) => {
      const rows = d.operations.filter((r) => inPeriod(r.startDate, p) && num(r.jobValue));
      return div(sum(rows, 'grossContribution'), sum(rows, 'jobValue'), true);
    } },
  { id: 'ops_on_time_pct', label: 'On-time delivery %', dept: 'operations', unit: 'percent', kind: 'flow', better: 'higher', agg: 'avg',
    help: 'Delivered/closed jobs (committed date in period) with zero delay days.',
    compute: (d, p) => {
      const done = d.operations.filter((r) => !opsActive(r) && inPeriod(r.committedDate, p));
      return div(done.filter((r) => n0(r.delayDays) === 0).length, done.length, true);
    } },
  { id: 'ops_unbilled_delivered', label: 'Delivered but not billed', dept: 'operations', unit: 'currency', kind: 'stock', better: 'lower', agg: 'avg',
    help: 'Value of delivered jobs whose billing status is still Not Billed — cash left on the table.',
    compute: (d) => sum(d.operations.filter((r) => !opsActive(r) && (r.billingStatus ?? 'Not Billed') === 'Not Billed'), 'jobValue') },
  { id: 'ops_escalations', label: 'Ops escalations', dept: 'operations', unit: 'count', kind: 'stock', better: 'lower', agg: 'avg',
    help: 'Open jobs with Escalation Needed = Yes.', compute: (d) => d.operations.filter((r) => opsActive(r) && r.escalationNeeded === 'Yes').length },

  // ── Sales
  { id: 'sales_open_pipeline', label: 'Open pipeline value', dept: 'sales', unit: 'currency', kind: 'stock', better: 'higher', agg: 'avg',
    help: 'Expected value of all open opportunities.', compute: (d) => sum(d.sales.filter(salesOpen), 'expectedValue') },
  { id: 'sales_weighted_pipeline', label: 'Weighted pipeline value', dept: 'sales', unit: 'currency', kind: 'stock', better: 'higher', agg: 'avg',
    help: 'Probability-adjusted forecast of open opportunities.', compute: (d) => sum(d.sales.filter(salesOpen), 'weightedValue') },
  { id: 'sales_new_leads', label: 'New leads', dept: 'sales', unit: 'count', kind: 'flow', better: 'higher', agg: 'sum',
    help: 'Opportunities with a lead date in the period.', compute: (d, p) => d.sales.filter((r) => inPeriod(r.leadDate, p)).length },
  { id: 'sales_proposals', label: 'Proposals sent', dept: 'sales', unit: 'count', kind: 'flow', better: 'higher', agg: 'sum',
    help: 'Proposal sent date in the period.', compute: (d, p) => d.sales.filter((r) => inPeriod(r.proposalSentDate, p)).length },
  { id: 'sales_deals_won', label: 'Deals won', dept: 'sales', unit: 'count', kind: 'flow', better: 'higher', agg: 'sum',
    help: 'Won deals with an actual closing date in the period.',
    compute: (d, p) => d.sales.filter((r) => r.dealStatus === 'Won' && inPeriod(r.actualCloseDate, p)).length },
  { id: 'sales_won_value', label: 'Won value', dept: 'sales', unit: 'currency', kind: 'flow', better: 'higher', agg: 'sum',
    help: 'Expected value of deals won in the period.',
    compute: (d, p) => sum(d.sales.filter((r) => r.dealStatus === 'Won' && inPeriod(r.actualCloseDate, p)), 'expectedValue') },
  { id: 'sales_win_rate', label: 'Win rate', dept: 'sales', unit: 'percent', kind: 'flow', better: 'higher', agg: 'avg',
    help: 'Won ÷ (won + lost) for deals closed in the period.',
    compute: (d, p) => {
      const closed = d.sales.filter((r) => ['Won', 'Lost'].includes(r.dealStatus) && inPeriod(r.actualCloseDate, p));
      return div(closed.filter((r) => r.dealStatus === 'Won').length, closed.length, true);
    } },
  { id: 'sales_overdue_followups', label: 'Overdue follow-ups', dept: 'sales', unit: 'count', kind: 'stock', better: 'lower', agg: 'avg',
    help: 'Open opportunities whose next follow-up date has passed.',
    compute: (d) => d.sales.filter((r) => salesOpen(r) && isPast(r.nextFollowUpDate)).length },
  { id: 'sales_cycle_days', label: 'Average sales cycle', dept: 'sales', unit: 'days', kind: 'flow', better: 'lower', agg: 'avg',
    help: 'Lead date → closing date, for deals won in the period.',
    compute: (d, p) => avg(d.sales.filter((r) => r.dealStatus === 'Won' && inPeriod(r.actualCloseDate, p)), 'salesCycleDays') },
  { id: 'sales_escalations', label: 'Sales escalations', dept: 'sales', unit: 'count', kind: 'stock', better: 'lower', agg: 'avg',
    help: 'Open opportunities with Escalation Required = Yes.', compute: (d) => d.sales.filter((r) => salesOpen(r) && r.escalationRequired === 'Yes').length },

  // ── Marketing
  { id: 'mkt_spend', label: 'Marketing spend', dept: 'marketing', unit: 'currency', kind: 'flow', better: 'lower', agg: 'sum',
    help: 'Actual spend of campaigns starting in the period.', compute: (d, p) => sum(d.marketing.filter((r) => inPeriod(r.startDate, p)), 'actualSpend') },
  { id: 'mkt_leads', label: 'Marketing leads', dept: 'marketing', unit: 'count', kind: 'flow', better: 'higher', agg: 'sum',
    help: 'Form fills / enquiries.', compute: (d, p) => sum(d.marketing.filter((r) => inPeriod(r.startDate, p)), 'leads') },
  { id: 'mkt_mql', label: 'MQLs', dept: 'marketing', unit: 'count', kind: 'flow', better: 'higher', agg: 'sum',
    help: 'Marketing-qualified leads.', compute: (d, p) => sum(d.marketing.filter((r) => inPeriod(r.startDate, p)), 'mql') },
  { id: 'mkt_sql', label: 'SQLs', dept: 'marketing', unit: 'count', kind: 'flow', better: 'higher', agg: 'sum',
    help: 'Sales-qualified leads.', compute: (d, p) => sum(d.marketing.filter((r) => inPeriod(r.startDate, p)), 'sql') },
  { id: 'mkt_cpl', label: 'Cost per lead (CPL)', dept: 'marketing', unit: 'currency', kind: 'flow', better: 'lower', agg: 'avg',
    help: 'Spend ÷ leads.', compute: (d, p) => {
      const rows = d.marketing.filter((r) => inPeriod(r.startDate, p));
      return div(sum(rows, 'actualSpend'), sum(rows, 'leads'));
    } },
  { id: 'mkt_cost_per_mql', label: 'Cost per MQL', dept: 'marketing', unit: 'currency', kind: 'flow', better: 'lower', agg: 'avg',
    help: 'Spend ÷ MQLs.', compute: (d, p) => {
      const rows = d.marketing.filter((r) => inPeriod(r.startDate, p));
      return div(sum(rows, 'actualSpend'), sum(rows, 'mql'));
    } },
  { id: 'mkt_lead_to_mql', label: 'Lead → MQL %', dept: 'marketing', unit: 'percent', kind: 'flow', better: 'higher', agg: 'avg',
    help: 'Lead quality.', compute: (d, p) => {
      const rows = d.marketing.filter((r) => inPeriod(r.startDate, p));
      return div(sum(rows, 'mql'), sum(rows, 'leads'), true);
    } },
  { id: 'mkt_mql_to_sql', label: 'MQL → SQL %', dept: 'marketing', unit: 'percent', kind: 'flow', better: 'higher', agg: 'avg',
    help: 'Sales acceptance of marketing leads.', compute: (d, p) => {
      const rows = d.marketing.filter((r) => inPeriod(r.startDate, p));
      return div(sum(rows, 'sql'), sum(rows, 'mql'), true);
    } },
  { id: 'mkt_revenue_influenced', label: 'Revenue influenced', dept: 'marketing', unit: 'currency', kind: 'flow', better: 'higher', agg: 'sum',
    help: 'Revenue attributed to campaigns in the period.', compute: (d, p) => sum(d.marketing.filter((r) => inPeriod(r.startDate, p)), 'revenueInfluenced') },

  // ── HR
  { id: 'hr_headcount', label: 'Headcount', dept: 'hr', unit: 'count', kind: 'stock', better: 'higher', agg: 'avg',
    help: 'Active, probation and notice-period employees.', compute: (d) => d.hr.filter(hrActive).length },
  { id: 'hr_people_cost', label: 'Monthly people cost', dept: 'hr', unit: 'currency', kind: 'stock', better: 'lower', agg: 'avg',
    help: 'Sum of monthly CTC for current employees.', compute: (d) => sum(d.hr.filter(hrActive), 'monthlyCtc') },
  { id: 'hr_utilization', label: 'Average utilisation', dept: 'hr', unit: 'percent', kind: 'stock', better: 'higher', agg: 'avg',
    help: 'Productive ÷ available hours, averaged over current employees.', compute: (d) => avg(d.hr.filter(hrActive), 'utilizationPct') },
  { id: 'hr_attendance', label: 'Average attendance', dept: 'hr', unit: 'percent', kind: 'stock', better: 'higher', agg: 'avg',
    help: 'Average attendance %.', compute: (d) => avg(d.hr.filter(hrActive), 'attendancePct') },
  { id: 'hr_kpi_achievement', label: 'Average KPI achievement', dept: 'hr', unit: 'percent', kind: 'stock', better: 'higher', agg: 'avg',
    help: 'Average KPI achievement %.', compute: (d) => avg(d.hr.filter(hrActive), 'kpiAchievementPct') },
  { id: 'hr_attrition_risk', label: 'High / critical attrition risk', dept: 'hr', unit: 'count', kind: 'stock', better: 'lower', agg: 'avg',
    help: 'Talent risk: employees flagged High or Critical.', compute: (d) => d.hr.filter((r) => hrActive(r) && ['High', 'Critical'].includes(r.attritionRisk)).length },

  // ── Cashflow
  { id: 'cash_collections', label: 'Actual collections', dept: 'cashflow', unit: 'currency', kind: 'flow', better: 'higher', agg: 'sum',
    help: 'Cash received in the period.', compute: (d, p) => sum(d.cashflow.filter((r) => inPeriod(r.entryDate, p)), 'actualCollections') },
  { id: 'cash_payments', label: 'Actual payments', dept: 'cashflow', unit: 'currency', kind: 'flow', better: 'lower', agg: 'sum',
    help: 'Cash paid out in the period.', compute: (d, p) => sum(d.cashflow.filter((r) => inPeriod(r.entryDate, p)), 'actualPayment') },
  { id: 'cash_net', label: 'Net cashflow', dept: 'cashflow', unit: 'currency', kind: 'flow', better: 'higher', agg: 'sum',
    help: 'Collections − payments in the period.', compute: (d, p) => {
      const rows = d.cashflow.filter((r) => inPeriod(r.entryDate, p));
      return sum(rows, 'actualCollections') - sum(rows, 'actualPayment');
    } },
  { id: 'cash_collection_efficiency', label: 'Collection efficiency', dept: 'cashflow', unit: 'percent', kind: 'flow', better: 'higher', agg: 'avg',
    help: 'Collections ÷ collections due in the period.', compute: (d, p) => {
      const rows = d.cashflow.filter((r) => inPeriod(r.entryDate, p));
      return div(sum(rows, 'actualCollections'), sum(rows, 'collectionsDue'), true);
    } },
  { id: 'cash_receivables', label: 'Total receivables', dept: 'cashflow', unit: 'currency', kind: 'stock', better: 'lower', agg: 'avg',
    help: 'All ageing buckets on open invoices.', compute: (d) => ['rec0_30', 'rec31_60', 'rec61_90', 'rec90plus'].reduce((a, k) => a + sum(d.cashflow, k), 0) },
  { id: 'cash_receivables_90', label: 'Receivables above 90 days', dept: 'cashflow', unit: 'currency', kind: 'stock', better: 'lower', agg: 'avg',
    help: 'High-risk collection.', compute: (d) => sum(d.cashflow, 'rec90plus') },
  { id: 'cash_gap_30', label: 'Cash gap next 30 days', dept: 'cashflow', unit: 'currency', kind: 'stock', better: 'lower', agg: 'avg',
    help: 'Projected shortfall over the next 30 days.', compute: (d) => sum(d.cashflow, 'cashGap30') },
  { id: 'cash_ceo_decisions', label: 'Cash decisions for CEO', dept: 'cashflow', unit: 'count', kind: 'stock', better: 'lower', agg: 'avg',
    help: 'Entries flagged CEO Decision Needed = Yes.', compute: (d) => d.cashflow.filter((r) => r.ceoDecision === 'Yes').length },

  // ── R&D
  { id: 'rnd_active', label: 'Active innovation initiatives', dept: 'rnd', unit: 'count', kind: 'stock', better: 'higher', agg: 'avg',
    help: 'Initiatives not launched or paused.', compute: (d) => d.rnd.filter(rndActive).length },
  { id: 'rnd_revenue_potential', label: 'Innovation revenue potential', dept: 'rnd', unit: 'currency', kind: 'stock', better: 'higher', agg: 'avg',
    help: 'Revenue potential of active initiatives.', compute: (d) => sum(d.rnd.filter(rndActive), 'revenuePotential') },
  { id: 'rnd_investment', label: 'Innovation investment', dept: 'rnd', unit: 'currency', kind: 'stock', better: 'lower', agg: 'avg',
    help: 'Actual investment to date across initiatives.', compute: (d) => sum(d.rnd, 'actualInvestment') },
  { id: 'rnd_pilots', label: 'Client pilots identified', dept: 'rnd', unit: 'count', kind: 'stock', better: 'higher', agg: 'avg',
    help: 'Active initiatives with a client pilot.', compute: (d) => d.rnd.filter((r) => rndActive(r) && r.clientPilot === 'Yes').length },
  { id: 'rnd_launched', label: 'Initiatives launched', dept: 'rnd', unit: 'count', kind: 'stock', better: 'higher', agg: 'avg',
    help: 'Initiatives at Launch stage.', compute: (d) => d.rnd.filter((r) => r.stage === 'Launch').length },
  { id: 'rnd_blocked', label: 'Blocked initiatives', dept: 'rnd', unit: 'count', kind: 'stock', better: 'lower', agg: 'avg',
    help: 'Active initiatives with a blocker recorded.', compute: (d) => d.rnd.filter((r) => rndActive(r) && String(r.blocker ?? '').trim()).length },
];

export const METRIC_BY_ID = Object.fromEntries(METRICS.map((m) => [m.id, m])) as Record<string, Metric>;

/** The board view — which metrics appear on the Executive Summary, in order. */
export const EXECUTIVE_METRICS = [
  'ops_active_jobs', 'ops_delayed_jobs', 'ops_gross_contribution', 'ops_unbilled_delivered',
  'sales_open_pipeline', 'sales_weighted_pipeline', 'sales_won_value', 'sales_overdue_followups',
  'mkt_spend', 'mkt_leads', 'mkt_cpl', 'mkt_mql',
  'hr_headcount', 'hr_utilization', 'hr_people_cost', 'hr_attrition_risk',
  'cash_collections', 'cash_net', 'cash_receivables_90', 'cash_gap_30',
  'rnd_active', 'rnd_revenue_potential', 'rnd_pilots', 'rnd_blocked',
];

/** Three key KPIs per department (Department Summary). */
export const DEPT_KEY_KPIS: Record<DeptKey, string[]> = {
  operations: ['ops_delayed_jobs', 'ops_gross_contribution', 'ops_escalations'],
  sales: ['sales_weighted_pipeline', 'sales_deals_won', 'sales_overdue_followups'],
  marketing: ['mkt_leads', 'mkt_mql', 'mkt_cpl'],
  hr: ['hr_utilization', 'hr_people_cost', 'hr_attrition_risk'],
  cashflow: ['cash_net', 'cash_receivables_90', 'cash_gap_30'],
  rnd: ['rnd_active', 'rnd_revenue_potential', 'rnd_pilots'],
};
