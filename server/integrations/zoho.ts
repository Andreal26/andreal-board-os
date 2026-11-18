import { upsertExternal } from '@/server/records';
import { parseDate } from '@/lib/validation';
import { fetchJson } from '@/server/integrations/shared';

/**
 * Zoho CRM → Sales tab.
 * Setup: create a Self Client in https://api-console.zoho.in, generate a grant token with scope
 * ZohoCRM.modules.deals.READ, exchange it for a refresh token, then fill ZOHO_* in the env.
 * Custom field API names differ per org — set ZOHO_FIELD_* to match yours (Setup → Developer Hub → APIs → API names).
 */
const env = (k: string, d = '') => process.env[k] || d;

async function accessToken() {
  const url = `${env('ZOHO_ACCOUNTS_URL', 'https://accounts.zoho.in')}/oauth/v2/token?` + new URLSearchParams({
    refresh_token: env('ZOHO_REFRESH_TOKEN'),
    client_id: env('ZOHO_CLIENT_ID'),
    client_secret: env('ZOHO_CLIENT_SECRET'),
    grant_type: 'refresh_token',
  });
  const body = await fetchJson(url, { method: 'POST' });
  if (!body.access_token) throw new Error(`Zoho token error: ${JSON.stringify(body).slice(0, 200)}`);
  return body.access_token as string;
}

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
    lost: env('ZOHO_FIELD_LOST_REASON', 'Reason_For_Loss'),
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

export async function syncZoho(): Promise<number> {
  const token = await accessToken();
  const base = `${env('ZOHO_API_URL', 'https://www.zohoapis.in')}/crm/${env('ZOHO_API_VERSION', 'v2')}/Deals`;
  let page = 1;
  let count = 0;
  for (;;) {
    const body = await fetchJson(`${base}?page=${page}&per_page=200&sort_by=Modified_Time&sort_order=desc`, {
      headers: { Authorization: `Zoho-oauthtoken ${token}` },
    });
    const deals: any[] = body.data ?? [];
    for (const d of deals) {
      const data = Object.fromEntries(Object.entries(mapDeal(d)).filter(([, v]) => v !== undefined && v !== ''));
      await upsertExternal('sales', 'zoho', String(d.id), data);
      count++;
    }
    if (!body.info?.more_records || page >= 50) break;
    page++;
  }
  return count;
}
