import { query } from '@/db/client';
import { loadAll } from '@/server/records';
import { DEPARTMENTS } from '@/config/departments';
import { opsActive, salesOpen, hrActive, rndActive } from '@/config/metrics';
import { daysFromToday, escapeHtml, fmtLakh, n0 } from '@/lib/utils';
import type { Alert, DeptKey, RecordData } from '@/types';
import { boardEmails, emailShell, sendMail, appUrl } from '@/server/mailer';

export type { Alert, Severity } from '@/types';

const overdueBy = (d: unknown) => {
  const n = daysFromToday(d);
  return n !== null && n < 0 ? -n : null;
};

type Rule = (r: RecordData) => Omit<Alert, 'dept' | 'company' | 'recordId' | 'title'> | null;

/** Alert rules per department. Each returns an alert for a row, or null. */
export const RULES: Record<DeptKey, Rule[]> = {
  operations: [
    (r) => opsActive(r) && r.deliveryStatus === 'Delayed'
      ? { rule: 'ops_delayed', severity: n0(r.delayDays) > 7 ? 'high' : 'medium', message: `Delayed ${n0(r.delayDays)} day(s)${r.delayReason ? ` — ${r.delayReason}` : ''}`, owner: r.owner } : null,
    (r) => opsActive(r) && r.deliveryStatus === 'At Risk'
      ? { rule: 'ops_at_risk', severity: 'medium', message: `At risk — committed ${r.committedDate ?? 'no date'}`, owner: r.owner } : null,
    (r) => { const o = opsActive(r) ? overdueBy(r.actionDueDate) : null;
      return o ? { rule: 'ops_action_overdue', severity: 'low', message: `Next action overdue by ${o} day(s): ${r.nextAction ?? '—'}`, owner: r.actionOwner } : null; },
    (r) => !opsActive(r) && (r.billingStatus ?? 'Not Billed') === 'Not Billed' && n0(r.jobValue) > 0
      ? { rule: 'ops_unbilled', severity: 'high', message: `Delivered but not billed — ₹${fmtLakh(n0(r.jobValue))}`, owner: r.owner } : null,
    (r) => opsActive(r) && r.escalationNeeded === 'Yes'
      ? { rule: 'ops_escalation', severity: 'high', message: 'Escalation requested', owner: r.owner } : null,
  ],
  sales: [
    (r) => { const o = salesOpen(r) ? overdueBy(r.nextFollowUpDate) : null;
      return o ? { rule: 'sales_followup_overdue', severity: o > 7 ? 'high' : 'medium', message: `Follow-up overdue by ${o} day(s) — ₹${fmtLakh(n0(r.expectedValue))} at ${r.stage ?? '—'}`, owner: r.salesOwner } : null; },
    (r) => salesOpen(r) && !r.nextFollowUpDate
      ? { rule: 'sales_no_followup', severity: 'low', message: 'Open opportunity with no next follow-up date', owner: r.salesOwner } : null,
    (r) => salesOpen(r) && n0(r.daysSinceContact) > 14
      ? { rule: 'sales_gone_quiet', severity: 'medium', message: `No contact for ${r.daysSinceContact} days`, owner: r.salesOwner } : null,
    (r) => salesOpen(r) && r.escalationRequired === 'Yes'
      ? { rule: 'sales_escalation', severity: 'high', message: `Escalation requested${r.keyObjection ? ` — objection: ${r.keyObjection}` : ''}`, owner: r.salesOwner } : null,
  ],
  marketing: [
    (r) => n0(r.leads) > 0 && r.cpl && r.cpl > 600
      ? { rule: 'mkt_high_cpl', severity: 'medium', message: `CPL ₹${r.cpl} on ${r.channel ?? 'campaign'}`, owner: r.actionOwner } : null,
    (r) => n0(r.actualSpend) > 5000 && n0(r.leads) === 0
      ? { rule: 'mkt_spend_no_leads', severity: 'high', message: `₹${fmtLakh(n0(r.actualSpend))} spent with zero leads`, owner: r.actionOwner } : null,
    (r) => n0(r.plannedBudget) > 0 && n0(r.actualSpend) > n0(r.plannedBudget) * 1.1
      ? { rule: 'mkt_over_budget', severity: 'medium', message: `Spend ₹${fmtLakh(n0(r.actualSpend))} vs budget ₹${fmtLakh(n0(r.plannedBudget))}`, owner: r.actionOwner } : null,
    (r) => { const o = overdueBy(r.nextReviewDate);
      return o ? { rule: 'mkt_review_overdue', severity: 'low', message: `Campaign review overdue by ${o} day(s)`, owner: r.actionOwner } : null; },
  ],
  hr: [
    (r) => hrActive(r) && ['High', 'Critical'].includes(r.attritionRisk)
      ? { rule: 'hr_attrition', severity: r.attritionRisk === 'Critical' ? 'high' : 'medium', message: `${r.attritionRisk} attrition risk — replacement criticality ${r.replacementCriticality ?? '—'}`, owner: r.actionOwner } : null,
    (r) => hrActive(r) && r.utilizationPct !== null && r.utilizationPct !== undefined && r.utilizationPct < 50
      ? { rule: 'hr_low_util', severity: 'low', message: `Utilisation ${r.utilizationPct}%`, owner: r.manager } : null,
    (r) => { const o = hrActive(r) ? overdueBy(r.reviewDate) : null;
      return o ? { rule: 'hr_review_overdue', severity: 'low', message: `People review overdue by ${o} day(s)`, owner: r.actionOwner } : null; },
  ],
  cashflow: [
    (r) => n0(r.rec90plus) > 0
      ? { rule: 'cash_90_plus', severity: 'high', message: `₹${fmtLakh(n0(r.rec90plus))} receivable above 90 days`, owner: r.actionOwner } : null,
    (r) => n0(r.cashGap7) > 0
      ? { rule: 'cash_gap_7', severity: 'high', message: `Cash gap ₹${fmtLakh(n0(r.cashGap7))} in the next 7 days`, owner: r.actionOwner } : null,
    (r) => r.ceoDecision === 'Yes'
      ? { rule: 'cash_ceo_decision', severity: 'medium', message: `CEO decision needed${r.notes ? `: ${r.notes}` : ''}`, owner: r.actionOwner } : null,
    (r) => { const o = overdueBy(r.dueDate);
      return o && (n0(r.collectionShortfall) > 0 || n0(r.paymentDeferred) > 0)
        ? { rule: 'cash_due_overdue', severity: 'medium', message: `Due ${o} day(s) ago — shortfall ₹${fmtLakh(n0(r.collectionShortfall) + n0(r.paymentDeferred))}`, owner: r.actionOwner } : null; },
  ],
  rnd: [
    (r) => rndActive(r) && String(r.blocker ?? '').trim()
      ? { rule: 'rnd_blocked', severity: 'medium', message: `Blocked: ${r.blocker}`, owner: r.owner } : null,
    (r) => rndActive(r) && String(r.decisionNeeded ?? '').trim()
      ? { rule: 'rnd_decision', severity: 'medium', message: `Decision needed: ${r.decisionNeeded}`, owner: r.owner } : null,
    (r) => { const o = rndActive(r) ? overdueBy(r.targetDate) : null;
      return o ? { rule: 'rnd_late', severity: 'low', message: `Past target completion by ${o} day(s)`, owner: r.owner } : null; },
  ],
};

export async function evaluateAlerts(): Promise<Alert[]> {
  const data = await loadAll('All');
  const out: Alert[] = [];
  for (const dept of Object.keys(RULES) as DeptKey[]) {
    const cfg = DEPARTMENTS[dept];
    for (const r of data[dept]) {
      for (const rule of RULES[dept]) {
        const a = rule(r);
        if (a) out.push({ ...a, dept, company: r._company, recordId: r._id, title: String(r[cfg.titleField] ?? `#${r._id}`) });
      }
    }
  }
  const rank = { high: 0, medium: 1, low: 2 };
  return out.sort((a, b) => rank[a.severity] - rank[b.severity]);
}

function alertTable(alerts: Alert[]) {
  const color = { high: '#ff4e42', medium: '#f2a93b', low: '#8a929c' };
  const rows = alerts.slice(0, 60).map((a) => `<tr>
    <td style="padding:6px 8px;border-bottom:1px solid #262c34"><span style="color:${color[a.severity]};font-weight:600;text-transform:uppercase;font-size:11px">${a.severity}</span></td>
    <td style="padding:6px 8px;border-bottom:1px solid #262c34;font-size:13px">${DEPARTMENTS[a.dept].short} · ${a.company}</td>
    <td style="padding:6px 8px;border-bottom:1px solid #262c34;font-size:13px"><a style="color:#fff" href="${appUrl()}/d/${a.dept}/${a.recordId}">${escapeHtml(a.title)}</a><br><span style="color:#aab1ba">${escapeHtml(a.message)}</span></td>
    <td style="padding:6px 8px;border-bottom:1px solid #262c34;font-size:12px;color:#aab1ba">${escapeHtml(a.owner ?? '')}</td></tr>`).join('');
  const more = alerts.length > 60 ? `<p style="color:#aab1ba;font-size:12px">…and ${alerts.length - 60} more in the app.</p>` : '';
  return `<table style="width:100%;border-collapse:collapse;background:#161a1f;border-radius:8px">${rows}</table>${more}`;
}


/** Evaluate, log and email the daily digest (board gets everything, owners get their departments). */
export async function runAlerts(opts: { email?: boolean } = {}) {
  const alerts = await evaluateAlerts();
  for (const a of alerts) {
    await query(
      `INSERT INTO alert_log (rule, severity, dept, company, record_id, message) VALUES ($1,$2,$3,$4,$5,$6)`,
      [a.rule, a.severity, a.dept, a.company, a.recordId, `${a.title}: ${a.message}`],
    );
  }
  const results: string[] = [];
  if (opts.email !== false && alerts.length) {
    const high = alerts.filter((a) => a.severity === 'high').length;
    const subject = `Board OS daily digest — ${alerts.length} alerts (${high} high)`;
    const r = await sendMail(boardEmails(), subject, emailShell('Daily control digest', alertTable(alerts)));
    results.push(`board: ${r.info}`);
    const owners = await query<{ email: string; departments: DeptKey[] }>(`SELECT email, departments FROM users WHERE active AND role = 'owner'`);
    for (const o of owners) {
      const mine = alerts.filter((a) => (o.departments ?? []).includes(a.dept));
      if (!mine.length) continue;
      const res = await sendMail([o.email], `Your department alerts — ${mine.length} open`, emailShell('Your department alerts', alertTable(mine)));
      results.push(`${o.email}: ${res.info}`);
    }
  }
  return { count: alerts.length, results };
}
