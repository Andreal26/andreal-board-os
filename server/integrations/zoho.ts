import { query } from '@/db/client';
import { upsertExternal } from '@/server/records';
import { parseDate } from '@/lib/validation';
import { fetchJson } from '@/server/integrations/shared';
import { zohoAccessToken, zohoConnection } from '@/server/integrations/zoho-oauth';

/**
 * Zoho CRM → Sales tab (full refresh of all Deals on every run; existing rows are updated in place).
 * Setup (no tokens to copy): create a "Server-based Application" client in https://api-console.zoho.in,
 * put ZOHO_CLIENT_ID / ZOHO_CLIENT_SECRET in the Space secrets, then click "Connect Zoho" in Settings.
 * The refresh token is stored in the database. (ZOHO_REFRESH_TOKEN in the env still works as an override.)
 * Custom field API names differ per org — set ZOHO_FIELD_* to match yours (Setup → Developer Hub → APIs → API names).
 */
const env = (k: string, d = '') => process.env[k] || d;

const accessToken = () => zohoAccessToken('crm');

const STAGE_MAP: Record<string, string> = {
  qualification: 'Discovery', 'needs analysis': 'Discovery', 'value proposition': 'Proposal',
  'id. decision makers': 'Discovery', 'perception analysis': 'Proposal', 'proposal/price quote': 'Proposal',
  'negotiation/review': 'Negotiation', 'closed won': 'Won', 'closed lost': 'Lost', 'closed-lost to competition': 'Lost',
};

const name = (v: any) => (v && typeof v === 'object' ? v.name : v) ?? '';

export function mapDeal(d: any) {
  const F = {
    status: env('ZOHO_FIELD_STATUS', 'Deal_Status'),
    company: env('ZOHO_FIELD_COMPANY', 'WORK_DONE_FOR'),
    product: env('ZOHO_FIELD_PRODUCT', 'Product'),
    prospector: env('ZOHO_FIELD_PROSPECTOR', 'Prospector'),
    lost: env('ZOHO_FIELD_LOST_REASON', 'Reason_For_Loss__s'),
  };
  const statusRaw = String(name(d[F.status]) || '').trim(); // Hot / Warm / Cold / Won / Lost in Andreal's org
  const stageRaw = String(d.Stage ?? '').toLowerCase();
  let dealStatus = 'Open';
  if (/won/i.test(statusRaw) || stageRaw.startsWith('closed won')) dealStatus = 'Won';
  else if (/lost/i.test(statusRaw) || stageRaw.startsWith('closed lost') || stageRaw.startsWith('closed-lost')) dealStatus = 'Lost';
  const quality = ['Hot', 'Warm', 'Cold'].find((q) => q.toLowerCase() === statusRaw.toLowerCase());
  const companyRaw = String(name(d[F.company]) || '').toLowerCase();
  const company = companyRaw.includes('anderson') ? 'Anderson' : 'Andreal';
  const close = parseDate(d.Closing_Date);
  const created = parseDate(d.Created_Time);
  return {
    company,
    opportunityId: String(d.id),
    leadDate: created ?? close ?? new Date().toISOString().slice(0, 10),
    prospectName: name(d.Account_Name) || d.Deal_Name || 'Unknown',
    contactPerson: name(d.Contact_Name) || undefined,
    leadSource: mapSource(d.Lead_Source),
    salesOwner: name(d[F.prospector]) || name(d.Owner) || undefined,
    product: Array.isArray(d[F.product]) ? d[F.product].join(', ') : name(d[F.product]) || d.Deal_Name || undefined,
    leadQuality: quality,
    stage: dealStatus === 'Won' ? 'Won' : dealStatus === 'Lost' ? 'Lost' : STAGE_MAP[stageRaw] ?? 'Proposal',
    expectedValue: d.Amount ?? undefined,
    probabilityPct: typeof d.Probability === 'number' ? d.Probability : undefined,
    expectedCloseDate: dealStatus === 'Open' ? close ?? undefined : undefined,
    actualCloseDate: dealStatus !== 'Open' ? close ?? undefined : undefined,
    dealStatus,
    lostReason: dealStatus === 'Lost' ? name(d[F.lost]) || undefined : undefined,
    notes: ['Zoho deal: ' + (d.Deal_Name ?? ''), d.WORK_STATUS ? 'Work status: ' + name(d.WORK_STATUS) : ''].filter(Boolean).join('; '),
  };
}

function mapSource(v: any) {
  const s = String(v ?? '').toLowerCase();
  if (!s) return undefined;
  if (s.includes('cold')) return 'Cold Call';
  if (s.includes('employee')) return 'Employee Referral';
  if (s.includes('referral') || s.includes('partner')) return 'External Referral';
  if (s.includes('facebook') || s.includes('meta') || s.includes('instagram')) return 'Meta';
  if (s.includes('google') || s.includes('adwords')) return 'Google';
  if (s.includes('linkedin')) return 'LinkedIn';
  if (s.includes('mail')) return 'Email';
  if (s.includes('web')) return 'Website';
  if (s.includes('existing')) return 'Existing Client';
  return 'Other';
}

/** Rows imported earlier from a Zoho CSV export carry the Zoho deal id — adopt them so the sync updates them instead of duplicating. */
async function adoptImportedDeals() {
  await query(
    `UPDATE records r SET source = 'zoho', external_id = r.data->>'opportunityId', updated_at = now()
     WHERE r.dept = 'sales' AND r.source IN ('import', 'manual') AND r.external_id IS NULL
       AND r.data->>'opportunityId' ~ '^[0-9]{10,}$'
       AND NOT EXISTS (SELECT 1 FROM records z WHERE z.dept = 'sales' AND z.source = 'zoho' AND z.external_id = r.data->>'opportunityId')`,
  );
}

const DEAL_FIELDS = 'Deal_Name,Account_Name,Amount,Stage,Closing_Date,Lead_Source,Owner,Contact_Name,Created_Time,Probability,Deal_Status,Product,Prospector,WORK_DONE_FOR,WORK_STATUS,Reason_For_Loss__s,Modified_Time';

export async function syncZoho(): Promise<number> {
  const token = await accessToken();
  await adoptImportedDeals();
  const conn = await zohoConnection();
  const fields = [DEAL_FIELDS, env('ZOHO_FIELD_STATUS'), env('ZOHO_FIELD_COMPANY'), env('ZOHO_FIELD_PRODUCT'), env('ZOHO_FIELD_PROSPECTOR'), env('ZOHO_FIELD_LOST_REASON')]
    .filter(Boolean).join(',').split(',').filter((v, i, a) => a.indexOf(v) === i).join(',');
  const base = `${conn.apiUrl}/crm/${env('ZOHO_API_VERSION', 'v2')}/Deals`;
  let page = 1;
  let count = 0;
  for (;;) {
    const body = await fetchJson(`${base}?fields=${fields}&page=${page}&per_page=200&sort_by=Modified_Time&sort_order=desc`, {
      headers: { Authorization: `Zoho-oauthtoken ${token}` },
    });
    const deals: any[] = body.data ?? [];
    for (const d of deals) {
      const data = Object.fromEntries(Object.entries(mapDeal(d)).filter(([, v]) => v !== undefined && v !== ''));
      await upsertExternal('sales', 'zoho', String(d.id), data);
      count++;
    }
    if (!body.info?.more_records || page >= 100) break;
    page++;
  }
  return count;
}
