import { LISTS, STAGE_PROBABILITY, type ListName } from '@/config/lists';
import { num, n0, ratio, round, toDate, todayUTC, daysBetween } from '@/lib/utils';
import type { DeptConfig, DeptKey, Field, RecordData } from '@/types';

/**
 * Department definitions — the single source of truth for every input tab.
 * Each field becomes a form input, a table column, a CSV column and an import validator.
 * `compute` fields are calculated on read (never typed), mirroring the workbook formulas.
 * To add or change a field, edit it here — no database migration is needed (rows are JSONB).
 */
export type { DeptConfig, DeptKey, Field, FieldType, RecordData } from '@/types';
export const DEPT_KEYS: DeptKey[] = ['operations', 'sales', 'marketing', 'hr', 'cashflow', 'rnd'];

// ── field factory ────────────────────────────────────────────
type FOpts = Partial<Omit<Field, 'key' | 'label' | 'type' | 'group'>>;
const F = (group: string) => ({
  text: (key: string, label: string, o: FOpts = {}): Field => ({ key, label, type: 'text', group, ...o }),
  area: (key: string, label: string, o: FOpts = {}): Field => ({ key, label, type: 'textarea', group, ...o }),
  num: (key: string, label: string, o: FOpts = {}): Field => ({ key, label, type: 'number', group, ...o }),
  cur: (key: string, label: string, o: FOpts = {}): Field => ({ key, label, type: 'currency', group, ...o }),
  pct: (key: string, label: string, o: FOpts = {}): Field => ({ key, label, type: 'percent', group, ...o }),
  date: (key: string, label: string, o: FOpts = {}): Field => ({ key, label, type: 'date', group, ...o }),
  sel: (key: string, label: string, list: ListName, o: FOpts = {}): Field => ({ key, label, type: 'select', list, group, ...o }),
  score: (key: string, label: string, max: number, o: FOpts = {}): Field => ({ key, label, type: 'score', max, group, ...o }),
});

const company = (group: string): Field => ({ key: 'company', label: 'Company', type: 'select', group, required: true, col: true });

// ── 03 Operations ────────────────────────────────────────────
const opsDone = (r: RecordData) => ['Delivered', 'Closed'].includes(r.deliveryStatus);
const ops = (() => {
  const a = F('Job'), b = F('Timeline'), c = F('Effort & cost'), d = F('Quality & billing'), e = F('Control');
  return [
    company('Job'),
    a.text('clientName', 'Client Name', { required: true, col: true }),
    a.text('jobId', 'Project / Job ID', { col: true }),
    a.text('jobName', 'Project / Job Name', { required: true, col: true }),
    a.text('serviceType', 'Service / Product Type'),
    a.text('owner', 'Project / Job Owner', { col: true }),
    b.date('startDate', 'Start Date'),
    b.date('committedDate', 'Committed Delivery Date', { col: true }),
    b.date('revisedDate', 'Revised Delivery Date'),
    b.sel('stage', 'Current Stage', 'StageOps', { col: true }),
    b.pct('completionPct', '% Completion'),
    b.sel('deliveryStatus', 'Delivery Status', 'DeliveryStatus', { col: true, required: true }),
    b.num('delayDays', 'Delay Days', {
      col: true,
      help: 'Revised − committed date; for open jobs without a revised date, today − committed date.',
      compute: (r) => {
        const committed = toDate(r.committedDate);
        if (!committed) return null;
        const revised = toDate(r.revisedDate);
        if (revised) return Math.max(0, daysBetween(committed, revised));
        if (opsDone(r)) return 0;
        return Math.max(0, daysBetween(committed, todayUTC()));
      },
    }),
    b.sel('delayReason', 'Delay Reason', 'DelayReason'),
    b.sel('clientApprovalPending', 'Client Approval Pending', 'YesNo'),
    b.sel('internalApprovalPending', 'Internal Approval Pending', 'YesNo'),
    c.text('assignedTeam', 'Assigned Team'),
    c.num('plannedHours', 'Planned Hours'),
    c.num('actualHours', 'Actual Hours Used'),
    c.pct('utilizationPct', 'Resource Utilization %', { compute: (r) => ratio(r.actualHours, r.plannedHours) }),
    c.cur('jobValue', 'Revenue / Job Value', { col: true }),
    c.cur('estimatedCost', 'Estimated Cost'),
    c.cur('actualCost', 'Actual Cost'),
    c.cur('vendorCost', 'Vendor / Outwork Cost'),
    c.cur('grossContribution', 'Gross Contribution', {
      col: true,
      compute: (r) => (num(r.jobValue) === null ? null : n0(r.jobValue) - n0(r.actualCost) - n0(r.vendorCost)),
    }),
    c.pct('grossContributionPct', 'Gross Contribution %', {
      compute: (r) => (num(r.jobValue) ? ratio(n0(r.jobValue) - n0(r.actualCost) - n0(r.vendorCost), r.jobValue) : null),
    }),
    d.num('reworkCount', 'Rework Count'),
    d.text('qualityIssues', 'Quality Issues'),
    d.sel('materialReadiness', 'Material / Input Readiness', 'MaterialReadiness'),
    d.sel('dispatchStatus', 'Dispatch / Delivery Status', 'DispatchStatus'),
    d.sel('billingStatus', 'Billing Status', 'BillingStatus', { col: true }),
    d.sel('collectionLinked', 'Collection Linked', 'YesNo'),
    e.sel('riskLevel', 'Risk Level', 'RiskLevel', { col: true }),
    e.sel('escalationNeeded', 'Escalation Needed', 'YesNo'),
    e.area('nextAction', 'Next Action'),
    e.text('actionOwner', 'Action Owner'),
    e.date('actionDueDate', 'Action Due Date'),
    e.area('notes', 'Management Notes'),
  ];
})();

// ── 04 Sales ─────────────────────────────────────────────────
const salesProb = (r: RecordData) => {
  const p = num(r.probabilityPct);
  if (p !== null) return p;
  if (r.dealStatus === 'Won') return 100;
  if (r.dealStatus === 'Lost') return 0;
  return STAGE_PROBABILITY[r.stage] ?? null;
};
const sales = (() => {
  const a = F('Opportunity'), b = F('Pipeline'), c = F('Closure'), e = F('Control');
  return [
    company('Opportunity'),
    a.text('opportunityId', 'Opportunity ID'),
    a.date('leadDate', 'Lead Date', { required: true }),
    a.text('prospectName', 'Prospect / Client Name', { required: true, col: true }),
    a.text('contactPerson', 'Contact Person'),
    a.sel('segment', 'Segment', 'Segment'),
    a.sel('leadSource', 'Lead Source', 'LeadSource', { col: true }),
    a.text('salesOwner', 'Sales Owner', { col: true }),
    a.text('product', 'Product / Service Offered', { col: true }),
    a.sel('leadQuality', 'Lead Quality', 'LeadQuality', { col: true }),
    b.sel('stage', 'Current Stage', 'SalesStage', { col: true, required: true }),
    b.date('lastContactDate', 'Last Contact Date'),
    b.date('nextFollowUpDate', 'Next Follow-Up Date', { col: true }),
    b.num('daysSinceContact', 'Days Since Last Contact', {
      compute: (r) => {
        const d = toDate(r.lastContactDate);
        return d ? daysBetween(d, todayUTC()) : null;
      },
    }),
    b.cur('expectedValue', 'Expected Deal Value', { col: true }),
    b.pct('probabilityPct', 'Probability %', { help: 'Leave blank to use the stage default (New 10% … Negotiation 75%).' }),
    b.cur('weightedValue', 'Weighted Pipeline Value', {
      col: true,
      compute: (r) => {
        const v = num(r.expectedValue);
        const p = salesProb(r);
        return v === null || p === null ? null : round((v * p) / 100, 0);
      },
    }),
    b.date('proposalSentDate', 'Proposal Sent Date'),
    b.cur('proposalValue', 'Proposal Value'),
    c.date('expectedCloseDate', 'Expected Closing Date'),
    c.date('actualCloseDate', 'Actual Closing Date'),
    c.sel('dealStatus', 'Deal Status', 'DealStatus', { col: true, required: true }),
    c.text('lostReason', 'Lost Reason'),
    c.text('competitor', 'Competitor Name'),
    c.cur('advanceReceived', 'Advance Received'),
    c.cur('billingPotentialMonth', 'Billing Potential This Month'),
    c.cur('collectionPotentialMonth', 'Collection Potential This Month'),
    c.num('salesCycleDays', 'Sales Cycle Days', {
      compute: (r) => {
        const a1 = toDate(r.leadDate), b1 = toDate(r.actualCloseDate);
        return a1 && b1 ? daysBetween(a1, b1) : null;
      },
    }),
    e.text('keyObjection', 'Key Objection'),
    e.sel('escalationRequired', 'Escalation Required', 'YesNo'),
    e.area('nextAction', 'Next Action'),
    e.text('actionOwner', 'Action Owner'),
    e.area('notes', 'Management Notes'),
  ];
})();

// ── 05 Marketing ─────────────────────────────────────────────
const marketing = (() => {
  const a = F('Campaign'), b = F('Reach & engagement'), c = F('Funnel'), e = F('Learning & control');
  return [
    company('Campaign'),
    a.text('campaignName', 'Campaign Name', { required: true, col: true }),
    a.sel('objective', 'Campaign Objective', 'CampaignObjective'),
    a.sel('segment', 'Target Segment', 'Segment'),
    a.text('persona', 'Persona'),
    a.sel('channel', 'Channel', 'Channel', { required: true, col: true }),
    a.text('assetName', 'Content / Ad Asset Name'),
    a.date('startDate', 'Campaign Start Date', { required: true, col: true }),
    a.date('endDate', 'Campaign End Date'),
    a.cur('plannedBudget', 'Planned Budget'),
    a.cur('actualSpend', 'Actual Spend', { col: true }),
    b.num('reach', 'Reach'),
    b.num('impressions', 'Impressions'),
    b.num('engagements', 'Engagements'),
    b.pct('engagementRate', 'Engagement Rate', { compute: (r) => ratio(r.engagements, r.impressions) }),
    b.num('clicks', 'Clicks'),
    b.pct('ctr', 'CTR', { compute: (r) => ratio(r.clicks, r.impressions) }),
    b.num('lpVisits', 'Landing Page Visits'),
    c.num('leads', 'Form Fills / Enquiries (Leads)', { col: true }),
    c.num('mql', 'MQL', { col: true }),
    c.num('sql', 'SQL', { col: true }),
    c.cur('cpl', 'CPL', { col: true, compute: (r) => (num(r.leads) ? round(n0(r.actualSpend) / n0(r.leads), 0) : null) }),
    c.cur('costPerMql', 'Cost per MQL', { compute: (r) => (num(r.mql) ? round(n0(r.actualSpend) / n0(r.mql), 0) : null) }),
    c.pct('leadToMql', 'Lead-to-MQL Conversion', { compute: (r) => ratio(r.mql, r.leads) }),
    c.pct('mqlToSql', 'MQL-to-SQL Conversion', { compute: (r) => ratio(r.sql, r.mql) }),
    c.num('salesAccepted', 'Sales Accepted Leads'),
    c.num('meetingsBooked', 'Meetings Booked'),
    c.num('dealsInfluenced', 'Deals Influenced'),
    c.cur('revenueInfluenced', 'Revenue Influenced'),
    e.text('bestCreative', 'Best Performing Creative'),
    e.text('weakestCreative', 'Weakest Performing Creative'),
    e.area('keyLearning', 'Key Learning'),
    e.area('correctiveAction', 'Corrective Action'),
    e.text('actionOwner', 'Action Owner'),
    e.date('nextReviewDate', 'Next Review Date'),
    e.area('notes', 'Management Notes'),
  ];
})();

// ── 06 HR ────────────────────────────────────────────────────
const hr = (() => {
  const a = F('Employee'), b = F('Productivity'), c = F('Development & risk');
  return [
    company('Employee'),
    a.text('employeeName', 'Employee Name', { required: true, col: true }),
    a.sel('department', 'Department', 'Department', { col: true }),
    a.text('role', 'Role', { col: true }),
    a.text('manager', 'Reporting Manager'),
    a.sel('employmentStatus', 'Employment Status', 'HRStatus', { required: true, col: true }),
    a.cur('monthlyCtc', 'Monthly Cost to Company'),
    b.pct('attendancePct', 'Attendance %', { col: true }),
    b.score('punctuality', 'Punctuality Score', 10),
    b.num('plannedTasks', 'Planned Tasks'),
    b.num('completedTasks', 'Completed Tasks'),
    b.pct('taskCompletionPct', 'Task Completion Rate', { col: true, compute: (r) => ratio(r.completedTasks, r.plannedTasks) }),
    b.pct('onTimePct', 'On-Time Completion Rate'),
    b.score('qualityScore', 'Quality Score', 10),
    b.num('reworkCaused', 'Rework Caused'),
    b.num('productiveHours', 'Billable / Productive Hours'),
    b.num('availableHours', 'Available Hours'),
    b.pct('utilizationPct', 'Utilization %', { col: true, compute: (r) => ratio(r.productiveHours, r.availableHours) }),
    b.pct('kpiAchievementPct', 'KPI Achievement %', { col: true }),
    b.score('managerRating', 'Manager Rating', 5),
    c.text('trainingNeeded', 'Training Needed'),
    c.sel('trainingCompleted', 'Training Completed', 'YesNo'),
    c.text('disciplineIssues', 'Behaviour / Team Discipline Issues'),
    c.sel('attritionRisk', 'Attrition Risk', 'RiskLevel', { col: true }),
    c.sel('replacementCriticality', 'Replacement Criticality', 'RiskLevel'),
    c.text('hiringRequirement', 'Hiring Requirement'),
    c.text('performanceAction', 'Performance Action Required'),
    c.text('actionOwner', 'Action Owner'),
    c.date('reviewDate', 'Review Date'),
    c.area('notes', 'Management Notes'),
  ];
})();

// ── 07 Cashflow / Accounts ───────────────────────────────────
const cashflow = (() => {
  const a = F('Entry'), b = F('Collections & billing'), c = F('Receivables ageing'), d = F('Payments & position'), e = F('Control');
  return [
    company('Entry'),
    a.date('entryDate', 'Entry Date', { required: true, col: true }),
    a.sel('type', 'Type', 'CashType', { required: true, col: true }),
    a.text('party', 'Client / Vendor / Account', { required: true, col: true }),
    a.text('invoiceNo', 'Invoice / Bill No.'),
    a.sel('category', 'Category', 'CashCategory'),
    a.cur('openingBank', 'Opening Bank Balance'),
    a.cur('openingCash', 'Opening Cash in Hand'),
    b.cur('collectionsDue', 'Collections Due'),
    b.cur('actualCollections', 'Actual Collections Received', { col: true }),
    b.cur('collectionShortfall', 'Collection Shortfall', {
      compute: (r) => (num(r.collectionsDue) === null ? null : n0(r.collectionsDue) - n0(r.actualCollections)),
    }),
    b.cur('invoiceRaised', 'Invoice Raised'),
    b.cur('invoicePending', 'Invoice Pending'),
    b.cur('unbilledWip', 'Unbilled Work-in-Progress'),
    c.cur('rec0_30', 'Receivables 0–30 Days', { help: 'Keep ageing current on open invoices; set to 0 once collected.' }),
    c.cur('rec31_60', 'Receivables 31–60 Days'),
    c.cur('rec61_90', 'Receivables 61–90 Days'),
    c.cur('rec90plus', 'Receivables Above 90 Days', { col: true }),
    d.cur('paymentDue', 'Payment Due'),
    d.cur('actualPayment', 'Actual Payment Made', { col: true }),
    d.cur('paymentDeferred', 'Payment Deferred', {
      compute: (r) => (num(r.paymentDue) === null ? null : n0(r.paymentDue) - n0(r.actualPayment)),
    }),
    d.cur('netCashflow', 'Net Cashflow', {
      col: true,
      compute: (r) => (num(r.actualCollections) === null && num(r.actualPayment) === null ? null : n0(r.actualCollections) - n0(r.actualPayment)),
    }),
    d.cur('closingCash', 'Closing Cash Position', {
      compute: (r) =>
        num(r.openingBank) === null && num(r.openingCash) === null
          ? null
          : n0(r.openingBank) + n0(r.openingCash) + n0(r.actualCollections) - n0(r.actualPayment),
    }),
    d.cur('cashGap7', 'Cash Gap Next 7 Days'),
    d.cur('cashGap30', 'Cash Gap Next 30 Days'),
    e.sel('collectionPriority', 'Collection Priority', 'Priority'),
    e.sel('paymentPriority', 'Payment Priority', 'Priority'),
    e.sel('riskLevel', 'Risk Level', 'RiskLevel', { col: true }),
    e.sel('ceoDecision', 'CEO Decision Needed', 'YesNo', { col: true }),
    e.text('actionOwner', 'Action Owner'),
    e.date('dueDate', 'Due Date'),
    e.area('notes', 'Management Notes'),
  ];
})();

// ── 08 R&D / Innovation ──────────────────────────────────────
const rnd = (() => {
  const a = F('Initiative'), b = F('Investment & value'), c = F('Feasibility'), e = F('Progress & control');
  return [
    company('Initiative'),
    a.text('initiativeName', 'Initiative Name', { required: true, col: true }),
    a.sel('category', 'Category', 'CategoryRnD', { col: true }),
    a.area('objective', 'Strategic Objective'),
    a.area('problem', 'Business Problem Solved'),
    a.text('owner', 'Owner', { col: true }),
    a.date('startDate', 'Start Date'),
    a.date('targetDate', 'Target Completion Date', { col: true }),
    a.sel('stage', 'Current Stage', 'RnDStage', { col: true, required: true }),
    a.sel('priority', 'Priority Level', 'Priority', { col: true }),
    b.cur('estInvestment', 'Estimated Investment'),
    b.cur('actualInvestment', 'Actual Investment'),
    b.cur('revenuePotential', 'Revenue Potential', { col: true }),
    b.cur('costSaving', 'Cost-Saving Potential'),
    c.sel('clientPilot', 'Client Pilot Identified', 'YesNo'),
    c.text('prototypeStatus', 'Prototype Status'),
    c.sel('techFeasibility', 'Technical Feasibility', 'Feasibility'),
    c.sel('marketFeasibility', 'Market Feasibility', 'Feasibility'),
    c.sel('riskLevel', 'Risk Level', 'RiskLevel'),
    c.sel('ipValue', 'IP / Differentiation Value', 'Feasibility'),
    c.text('dependencies', 'Dependencies'),
    e.text('milestoneCompleted', 'Milestone Completed'),
    e.text('nextMilestone', 'Next Milestone'),
    e.text('blocker', 'Blocker', { col: true }),
    e.text('decisionNeeded', 'Decision Needed'),
    e.text('actionOwner', 'Action Owner'),
    e.date('reviewDate', 'Review Date'),
    e.area('notes', 'Management Notes'),
  ];
})();

const groupsOf = (fields: Field[]) => Array.from(new Set(fields.map((f) => f.group)));

export const DEPARTMENTS: Record<DeptKey, DeptConfig> = {
  operations: {
    key: 'operations', name: 'Operations', short: 'Ops',
    purpose: 'Active projects and jobs, delays, utilisation, QC, billing readiness and escalation. Andreal: digital and creative projects. Anderson: print jobs, production, QC and dispatch.',
    titleField: 'jobName', dateField: 'startDate', fields: ops, groups: groupsOf(ops),
  },
  sales: {
    key: 'sales', name: 'Sales', short: 'Sales',
    purpose: 'Every opportunity: expected value, weighted pipeline, follow-up discipline, closure probability and senior intervention.',
    titleField: 'prospectName', dateField: 'leadDate', fields: sales, groups: groupsOf(sales),
  },
  marketing: {
    key: 'marketing', name: 'Marketing', short: 'Mktg',
    purpose: 'Funnel control, not activity reporting: spend, leads, MQL, SQL, CPL, conversion, learning and corrective action. One row per campaign per month.',
    titleField: 'campaignName', dateField: 'startDate', fields: marketing, groups: groupsOf(marketing),
  },
  hr: {
    key: 'hr', name: 'HR', short: 'HR',
    purpose: 'People cost against productivity, utilisation, task completion, quality, training needs and attrition risk. Restricted to admin, CEO and HR owners.',
    titleField: 'employeeName', dateField: 'reviewDate', fields: hr, groups: groupsOf(hr),
  },
  cashflow: {
    key: 'cashflow', name: 'Cashflow / Accounts', short: 'Cash',
    purpose: 'Expected vs actual collections, payment pressure, receivables ageing, cash gap and CEO-level cash decisions.',
    titleField: 'party', dateField: 'entryDate', fields: cashflow, groups: groupsOf(cashflow),
  },
  rnd: {
    key: 'rnd', name: 'R&D / Innovation', short: 'R&D',
    purpose: 'Andreal AI / automation / immersive innovation and Anderson intelligent print, AR print, QR/NFC, web-to-print and packaging initiatives.',
    titleField: 'initiativeName', dateField: 'startDate', fields: rnd, groups: groupsOf(rnd),
  },
};

export function isDeptKey(v: string): v is DeptKey {
  return (DEPT_KEYS as string[]).includes(v);
}

export function optionsFor(field: Field): readonly string[] | undefined {
  if (field.key === 'company') return ['Andreal', 'Anderson'];
  return field.list ? LISTS[field.list] : undefined;
}

/** Adds all computed fields to a record's data. */
export function withComputed(dept: DeptKey, data: RecordData): RecordData {
  const out: RecordData = { ...data };
  for (const f of DEPARTMENTS[dept].fields) {
    if (f.compute) out[f.key] = f.compute(out);
  }
  if (dept === 'sales') out._probability = salesProb(out);
  return out;
}
