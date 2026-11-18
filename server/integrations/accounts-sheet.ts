import { getSetting, query } from '@/db/client';
import { upsertExternal } from '@/server/records';
import { fetchJson } from '@/server/integrations/shared';
import type { RecordData } from '@/types';

/**
 * Google Sheets "Andreal Accounts 26-27" → Cashflow tab. One row per invoice line of the "Invoice Responses" tab.
 *
 * Transport: a small Google Apps Script web app inside the accounts sheet (see docs/apps-script/accounts-sheet.gs)
 * returns the tab as JSON when called with its secret token. The admin pastes that link once in
 * Settings → Integrations (stored in the database), or sets ACCOUNTS_SHEET_URL. No Google Cloud project needed.
 *
 * Figures: "Bill Amount with GST" = invoice raised / collection due; "Remarks (Billing wise payment recv)" = amount
 * received (the trusted payment figure). Pending = due − received, aged by invoice date into 0–30/31–60/61–90/90+.
 */
const SOURCE = 'sheets';
const SETTING = 'accounts_sheet_url';

export async function accountsSheetConnection() {
  const env = process.env.ACCOUNTS_SHEET_URL || null;
  const db = env ? null : await getSetting(SETTING);
  return {
    url: env || db,
    source: (env ? 'env' : db ? 'database' : 'none') as 'env' | 'database' | 'none',
    connectedAt: await getSetting('accounts_sheet_connected_at'),
  };
}

export function validAccountsUrl(url: string) {
  try {
    const u = new URL(url);
    return u.protocol === 'https:' && u.hostname === 'script.google.com' && /^\/(a\/macros\/[^/]+|macros)\/s\/[^/]+\/exec$/.test(u.pathname) && !!u.searchParams.get('token');
  } catch {
    return false;
  }
}

export async function saveAccountsSheetUrl(url: string) {
  for (const [k, v] of [[SETTING, url], ['accounts_sheet_connected_at', new Date().toISOString()]])
    await query(`INSERT INTO app_settings (key, value) VALUES ($1, $2) ON CONFLICT (key) DO UPDATE SET value = EXCLUDED.value`, [k, v]);
}

export async function disconnectAccountsSheet() {
  await query(`DELETE FROM app_settings WHERE key IN ($1, 'accounts_sheet_connected_at')`, [SETTING]);
}

// ── helpers ──────────────────────────────────────────────────
const num = (v: unknown): number | null => {
  if (typeof v === 'number') return Number.isFinite(v) ? v : null;
  const x = parseFloat(String(v ?? '').replace(/[,₹\s]/g, ''));
  return Number.isFinite(x) ? x : null;
};
const str = (v: unknown) => String(v ?? '').trim();

/** Accepts yyyy-mm-dd (from the script) or the sheet's M/D/YYYY display format. */
export function isoDate(v: unknown): string | undefined {
  const s = str(v);
  let m = s.match(/^(\d{4})-(\d{2})-(\d{2})/);
  if (m) return `${m[1]}-${m[2]}-${m[3]}`;
  m = s.match(/^(\d{1,2})\/(\d{1,2})\/(\d{4})/);
  if (m) return `${m[3]}-${m[1].padStart(2, '0')}-${m[2].padStart(2, '0')}`;
  return undefined;
}

const todayIst = () => new Date(Date.now() + 5.5 * 3600_000).toISOString().slice(0, 10);
const daysBetween = (a: string, b: string) => Math.round((Date.parse(b) - Date.parse(a)) / 86_400_000);

/** Billing accounts: ATPL = Anderson Technology; AIPL / ANDREAL / GGPL / GCPL / OTHERS are Andreal's books. */
function companyOf(acct: string): 'Andreal' | 'Anderson' {
  const anderson = (process.env.ACCOUNTS_ANDERSON_ACCOUNTS || 'ATPL').split(',').map((s) => s.trim().toUpperCase());
  return anderson.includes(acct.toUpperCase()) ? 'Anderson' : 'Andreal';
}

const riskFor = (pending: number, age: number) => (pending <= 0 ? 'Low' : age > 90 ? 'High' : age > 60 ? 'Medium' : 'Low');

export function mapInvoiceRow(row: Record<string, unknown>, today = todayIst()): RecordData | null {
  const job = str(row['Job Number']);
  const invoiceNo = str(row['Invoice No']);
  if (!job && !invoiceNo) return null;
  const bill = num(row['Bill Amount with GST']) ?? 0;
  const received = num(row['Remarks (Billing wise payment recv)']) ?? 0;
  const billed = str(row['Billing Status']).toLowerCase() !== 'non billed';
  const date = isoDate(row['Invoice date']) || isoDate(row['Date']);
  const acct = str(row['Billing Account']);
  const pending = Math.max(0, bill - received);
  const age = date ? Math.max(0, daysBetween(date, today)) : 0;
  const bucket = (lo: number, hi: number) => (billed && pending > 0 && age >= lo && age <= hi ? pending : 0);
  const risk = riskFor(billed ? pending : 0, age);
  const notesParts = [
    `From Accounts sheet (Invoice Responses), job ${job || '—'}`,
    str(row["Client's Name (Billing name)"]) && `billed to ${str(row["Client's Name (Billing name)"])}`,
    acct && `account ${acct}`,
    str(row['Department']) && `dept ${str(row['Department'])}`,
    str(row['Product']) && `product ${str(row['Product'])}`,
    !billed && 'not billed yet',
    received > bill + 1 && `received exceeds bill by ₹${Math.round(received - bill).toLocaleString('en-IN')} (check allocation)`,
  ].filter(Boolean);
  return {
    company: companyOf(acct),
    entryDate: date,
    type: 'Collection',
    party: str(row['Client name']) || str(row["Client's Name (Billing name)"]) || 'Unknown client',
    invoiceNo: invoiceNo || undefined,
    category: 'Client Receipt',
    collectionsDue: billed ? bill : 0,
    actualCollections: received,
    invoiceRaised: billed ? bill : 0,
    invoicePending: billed ? pending : 0,
    unbilledWip: billed ? 0 : pending,
    rec0_30: bucket(0, 30),
    rec31_60: bucket(31, 60),
    rec61_90: bucket(61, 90),
    rec90plus: billed && pending > 0 && age > 90 ? pending : 0,
    collectionPriority: risk,
    riskLevel: risk,
    actionOwner: str(row['Client Servicing']) || undefined,
    notes: notesParts.join('; '),
  };
}

export async function syncAccountsSheet(): Promise<number> {
  const { url } = await accountsSheetConnection();
  if (!url) throw new Error('Accounts sheet link not set');
  const body: any = await fetchJson(url, { redirect: 'follow' });
  if (body?.error) throw new Error(`Apps Script: ${body.error}`);
  const header: string[] = body.header ?? [];
  const rows: unknown[][] = body.rows ?? [];
  if (!header.includes('Invoice No') || !header.includes('Bill Amount with GST')) throw new Error('Unexpected sheet columns — is this the Invoice Responses tab?');
  const today = todayIst();
  const seen = new Map<string, number>();
  const ids: string[] = [];
  for (const r of rows) {
    const obj = Object.fromEntries(header.map((h, i) => [h, r[i]]));
    const data = mapInvoiceRow(obj, today);
    if (!data) continue;
    const base = `inv:${str(obj['Invoice No']) || 'none'}:${str(obj['Job Number'])}`;
    const n = (seen.get(base) ?? 0) + 1;
    seen.set(base, n);
    const id = n === 1 ? base : `${base}#${n}`;
    ids.push(id);
    await upsertExternal('cashflow', SOURCE, id, Object.fromEntries(Object.entries(data).filter(([, v]) => v !== undefined)) as RecordData);
  }
  // Lines deleted from the sheet are removed here too (only when the sheet returned data).
  if (ids.length)
    await query(`DELETE FROM records WHERE dept = 'cashflow' AND source = $1 AND NOT (external_id IN (SELECT jsonb_array_elements_text($2::jsonb)))`, [SOURCE, JSON.stringify(ids)]);
  return ids.length;
}
