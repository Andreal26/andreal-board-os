/**
 * Seed data: the 9 real R&D initiatives from the board workbook, plus optional demo rows
 * (source = "demo") so the board can be shown before real data is entered.
 */
import { query } from '@/db/client';
import { normalize } from '@/lib/validation';
import workbookRnd from '@/data/seed/workbook-rnd.json';
import vocab from '@/data/seed/demo-vocabulary.json';
import type { DeptKey } from '@/config/departments';

const RND = [
  ['Design System Generation Workflow', 'Design', 'Create Custom Design Systems for Input into Agentic AI', 'A complete design rules document for various Design processes and outputs', '25/03/2026', 'Research', 'Design System generation recreation as per AI systems'],
  ['Landing Page Generation Workflow', 'Design', 'Generate Landing Pages Based using Agentic AI systems or Tools', 'Generating Landing Pages based on Branding information', '', 'Research', 'Revamp - Landing Page generation recreation as per AI systems'],
  ['Slides/Deck Generation Workflow', 'Design', 'Generate Slides/Deck Presentations Based using Agentic AI systems or Tools', 'Generating Slides/Deck Presentations based on Branding information', '', 'Idea', 'Not Started'],
  ['Brochure/Print Generation Workflow', 'Design', 'Generate Brochure/Print Based using Agentic AI systems or Tools', 'Generating Brochures/Print based on Branding information', '', 'Idea', 'Not Started'],
  ['Static Post Generation Workflow', 'Design', 'Generate Static Post Based using Agentic AI systems or Tools', 'Generating Static Posts based on Branding information', '', 'Research', 'Revamp - Static Post generation recreation as per AI systems'],
  ['Annual Report Microsite Generation', 'Design', 'Generate Annual Report Based using Agentic AI systems or Tools', 'Generating Annual Reports Microsite based on Branding information', '2026-04-03', 'Research', 'Revamp - Annual Report microsite generation recreation as per AI systems'],
  ['Video Generation Workflow', 'Video', 'Generate Video Based using Agentic AI systems or Tools', 'Generating Videos based on Branding information', '16/04/2026', 'Prototype', 'In Progress'],
  ['Design Audit Workflow', 'Design', 'AI Audit for Designs', 'Understanding Design Gaps with Expert AI Analysis Module', '', 'Idea', 'Not Started'],
  ['Annual Report Audit', 'Design', 'AI Audit for Annual Reports', 'Understanding Annual Report Gaps with Expert AI Analysis Module', '2026-03-04', 'Launch', 'Delivered'],
];

async function insert(dept: DeptKey, raw: Record<string, unknown>, source: string, externalId: string | null = null) {
  const { data, errors } = normalize(dept, raw);
  if (errors.length) throw new Error(`${dept}: ${errors.join('; ')} in ${JSON.stringify(raw)}`);
  await query(
    `INSERT INTO records (dept, company, data, source, external_id) VALUES ($1,$2,$3::jsonb,$4,$5)
     ON CONFLICT (dept, source, external_id) WHERE external_id IS NOT NULL DO UPDATE SET data = EXCLUDED.data, updated_at = now()`,
    [dept, data.company, JSON.stringify(data), source, externalId],
  );
}

export async function seedRnd() {
  for (const [i, r] of RND.entries()) {
    await insert('rnd', {
      company: 'Andreal', initiativeName: r[0], category: r[1], objective: r[2], problem: r[3],
      startDate: r[4] || undefined, stage: r[5], priority: 'Medium', notes: `Status in workbook: ${r[6]}`,
    }, 'seed', `workbook-rnd-${i + 1}`);
  }
  console.log(`✓ R&D: ${RND.length} initiatives from the board workbook`);
}

// ── demo data (deterministic) ────────────────────────────────
let s = 42;
const rnd = () => ((s = (s * 16807) % 2147483647) / 2147483647);
const pick = <T,>(a: readonly T[]) => a[Math.floor(rnd() * a.length)];
const int = (a: number, b: number) => Math.floor(a + rnd() * (b - a + 1));
const day = (offset: number) => new Date(Date.now() + offset * 86400000).toISOString().slice(0, 10);

export async function seedDemo() {
  const { clients, services, salesPeople: people, jobOwners, roles } = vocab as unknown as {
    clients: string[]; services: Record<'Andreal' | 'Anderson', string[]>; salesPeople: string[]; jobOwners: string[]; roles: [string, string][];
  };
  let n = 0;

  for (let i = 0; i < 18; i++) {
    const company = i % 3 === 0 ? 'Anderson' : 'Andreal';
    const committed = int(-25, 30);
    const status = committed < -5 ? pick(['Delivered', 'Delivered', 'Closed', 'Delayed']) : pick(['On Track', 'On Track', 'At Risk', 'Delayed']);
    const value = int(4, 60) * 5000;
    await insert('operations', {
      company, clientName: pick(clients), jobId: `${company === 'Andreal' ? 'AND' : 'ATPL'}-${2600 + i}`, jobName: `${pick(services[company])} — ${pick(['Phase 1', 'Q3', 'Launch', 'Annual'])}`,
      serviceType: pick(services[company]), owner: pick(jobOwners),
      startDate: day(committed - int(15, 45)), committedDate: day(committed), revisedDate: status === 'Delayed' && rnd() > 0.5 ? day(committed + int(3, 12)) : undefined,
      stage: status === 'Delivered' || status === 'Closed' ? 'Closed' : pick(['Design', 'Content', 'Client Approval', 'Production', 'QC']),
      completionPct: status === 'Delivered' || status === 'Closed' ? 100 : int(10, 90), deliveryStatus: status,
      delayReason: status === 'Delayed' ? pick(['Client Delay', 'Approval Delay', 'Vendor Delay', 'Internal Delay']) : 'No Delay',
      plannedHours: int(20, 120), actualHours: int(15, 140), jobValue: value, actualCost: Math.round(value * (0.25 + rnd() * 0.3)), vendorCost: company === 'Anderson' ? Math.round(value * 0.2) : 0,
      billingStatus: status === 'Delivered' ? pick(['Fully Billed', 'Not Billed', 'Part Billed']) : 'Not Billed', riskLevel: status === 'Delayed' ? 'High' : pick(['Low', 'Medium']),
      escalationNeeded: status === 'Delayed' && rnd() > 0.6 ? 'Yes' : 'No', nextAction: 'Client review call', actionOwner: pick(people), actionDueDate: day(int(-4, 7)),
    }, 'demo'); n++;
  }

  const stages = ['New', 'Contacted', 'Discovery', 'Proposal', 'Negotiation'] as const;
  for (let i = 0; i < 30; i++) {
    const company = i % 4 === 0 ? 'Anderson' : 'Andreal';
    const leadOffset = int(-80, -1);
    const closed = rnd() < 0.35;
    const won = closed && rnd() < 0.55;
    const value = int(2, 40) * 10000;
    await insert('sales', {
      company, opportunityId: `OPP-${3100 + i}`, leadDate: day(leadOffset), prospectName: pick(clients) + (rnd() > 0.7 ? ' (new unit)' : ''),
      segment: pick(['Education', 'Real Estate', 'Hospitality', 'MSME / Manufacturing', 'Corporate']), leadSource: pick(['Cold Call', 'Meta', 'Google', 'LinkedIn', 'Email', 'External Referral', 'Existing Client']),
      salesOwner: pick(people), product: pick(services[company]), leadQuality: pick(['Hot', 'Warm', 'Warm', 'Cold']),
      stage: closed ? (won ? 'Won' : 'Lost') : pick(stages), lastContactDate: day(int(-25, -1)), nextFollowUpDate: closed ? undefined : day(int(-10, 10)),
      expectedValue: value, proposalSentDate: rnd() > 0.4 ? day(leadOffset + int(3, 20)) : undefined, expectedCloseDate: day(int(5, 45)),
      actualCloseDate: closed ? day(int(Math.max(leadOffset + 5, -60), -1)) : undefined, dealStatus: closed ? (won ? 'Won' : 'Lost') : 'Open',
      lostReason: closed && !won ? pick(['Price', 'Lost to competition', 'No budget']) : undefined, escalationRequired: !closed && rnd() > 0.85 ? 'Yes' : 'No',
    }, 'demo'); n++;
  }

  for (const monthOffset of [-1, 0]) {
    const d = new Date(); d.setUTCDate(1); d.setUTCMonth(d.getUTCMonth() + monthOffset);
    const start = d.toISOString().slice(0, 10);
    for (const [channel, base, cplBase] of [['Meta', 60000, 350], ['Google', 35000, 800], ['LinkedIn', 30000, 1200]] as const) {
      for (const persona of ['Education', 'Real Estate']) {
        const spend = Math.round(base * (0.4 + rnd() * 0.5));
        const leads = Math.max(1, Math.round(spend / (cplBase * (0.7 + rnd() * 0.7))));
        const mql = Math.round(leads * (0.05 + rnd() * 0.12));
        await insert('marketing', {
          company: 'Andreal', campaignName: `${channel} · ${persona} admissions/enquiries (${start.slice(0, 7)})`, objective: 'Lead Generation', segment: persona, persona: persona === 'Education' ? 'Principal / Trustee' : 'Home buyer 30–50',
          channel, startDate: start, plannedBudget: Math.round(base * 0.6), actualSpend: spend, impressions: spend * int(8, 20), reach: spend * int(4, 9), clicks: Math.round(spend / int(8, 25)),
          leads, mql, sql: Math.round(mql * (0.2 + rnd() * 0.3)), meetingsBooked: Math.round(mql * 0.3), keyLearning: 'Video creatives outperform static', nextReviewDate: day(int(-3, 10)),
        }, 'demo'); n++;
      }
    }
  }

  for (const [i, [dep, role]] of roles.entries()) {
    const available = 176;
    await insert('hr', {
      company: dep === 'Print / Production' ? 'Anderson' : 'Andreal', employeeName: `Demo Employee ${i + 1}`, department: dep, role, manager: 'NKK Sir', employmentStatus: i === 9 ? 'Probation' : 'Active',
      monthlyCtc: int(25, 90) * 1000, attendancePct: int(82, 99), punctuality: int(6, 10), plannedTasks: int(20, 40), completedTasks: int(15, 38), onTimePct: int(60, 95), qualityScore: int(6, 10),
      productiveHours: int(90, 165), availableHours: available, kpiAchievementPct: int(55, 110), managerRating: int(3, 5), attritionRisk: pick(['Low', 'Low', 'Medium', 'High']), reviewDate: day(int(-10, 30)),
    }, 'demo'); n++;
  }

  for (let m = -5; m <= 0; m++) {
    for (let k = 0; k < 4; k++) {
      const d = new Date(); d.setUTCDate(1); d.setUTCMonth(d.getUTCMonth() + m); d.setUTCDate(int(1, m === 0 ? Math.max(1, new Date().getUTCDate()) : 27));
      const isCollection = k < 2;
      const due = int(2, 12) * 25000;
      await insert('cashflow', {
        company: k === 3 ? 'Anderson' : 'Andreal', entryDate: d.toISOString().slice(0, 10), type: isCollection ? 'Collection' : 'Payment', party: isCollection ? pick(clients) : pick(['Salaries', 'Print vendor', 'Office rent', 'Meta Ads', 'GST']),
        invoiceNo: isCollection ? `INV-${int(1000, 1999)}` : undefined, category: isCollection ? 'Client Receipt' : pick(['Salary', 'Vendor', 'Rent', 'Marketing', 'Statutory']),
        collectionsDue: isCollection ? due : undefined, actualCollections: isCollection ? Math.round(due * (0.5 + rnd() * 0.5)) : undefined,
        paymentDue: isCollection ? undefined : due, actualPayment: isCollection ? undefined : Math.round(due * (0.7 + rnd() * 0.3)),
        rec0_30: m === 0 && isCollection ? int(1, 6) * 20000 : 0, rec31_60: m === -1 && isCollection ? int(1, 4) * 15000 : 0, rec61_90: m === -2 && isCollection ? int(0, 3) * 15000 : 0, rec90plus: m <= -3 && isCollection && rnd() > 0.6 ? int(1, 3) * 20000 : 0,
        cashGap30: m === 0 && k === 2 ? 150000 : 0, riskLevel: pick(['Low', 'Medium']), ceoDecision: m === 0 && k === 2 ? 'Yes' : 'No', dueDate: day(int(-8, 10)),
        notes: m === 0 && k === 2 ? 'Defer vendor payment or draw on OD?' : undefined,
      }, 'demo'); n++;
    }
  }
  await query(`UPDATE records SET data = data || '{"clientPilot":"Yes","revenuePotential":600000}'::jsonb WHERE dept = 'rnd' AND data->>'initiativeName' = 'Video Generation Workflow'`);
  console.log(`✓ Demo: ${n} rows across Operations, Sales, Marketing, HR and Cashflow (source = "demo")`);

  const month = new Date().toISOString().slice(0, 7);
  const targets = vocab.demoTargets as Record<string, number>;
  for (const [metric, value] of Object.entries(targets)) {
    await query(`INSERT INTO targets (company, metric, month, value) VALUES ('All',$1,$2,$3) ON CONFLICT (company, metric, month) DO UPDATE SET value = EXCLUDED.value`, [metric, month, value]);
  }
  console.log(`✓ Demo targets for ${month} (the December KPI sheet's CPL ≤ ₹400 / 500 leads / 30 MQL / 6 SQL)`);
  return n;
}


export async function clearDemo() {
  const r = await query<{ n: number }>(`WITH d AS (DELETE FROM records WHERE source = 'demo' RETURNING 1) SELECT count(*)::int AS n FROM d`);
  return r[0].n;
}

export async function demoCount() {
  const [{ n }] = await query<{ n: number }>(`SELECT count(*)::int AS n FROM records WHERE source = 'demo'`);
  return n;
}

/** First start on an empty database: load the workbook's R&D initiatives (set SEED_WORKBOOK=false to skip). */
export async function seedIfEmpty() {
  if (process.env.SEED_WORKBOOK === 'false') return;
  const [{ n }] = await query<{ n: number }>(`SELECT count(*)::int AS n FROM records`);
  if (n === 0) await seedRnd();
}
