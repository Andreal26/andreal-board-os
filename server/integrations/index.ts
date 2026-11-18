import { query, one } from '@/db/client';
import { syncZoho } from '@/server/integrations/zoho';
import { zohoConnection } from '@/server/integrations/zoho-oauth';
import { syncMeta } from '@/server/integrations/meta';
import { syncGoogleAds } from '@/server/integrations/google-ads';
import { syncLinkedIn } from '@/server/integrations/linkedin';
import { syncAccountsSheet, accountsSheetConnection } from '@/server/integrations/accounts-sheet';
export { syncMonths, fetchJson } from '@/server/integrations/shared';

/**
 * Integration registry. Every integration is OFF until <NAME>_ENABLED=true and its keys are set.
 * Each sync is idempotent: rows are upserted by (dept, source, external_id).
 */
export interface Integration {
  key: string;
  name: string;
  feeds: string;
  envFlag: string;
  requiredEnv: string[];
  run: () => Promise<number>; // returns rows upserted
}

export const INTEGRATIONS: Integration[] = [
  {
    key: 'zoho', name: 'Zoho CRM', feeds: 'Sales (deals → opportunities)', envFlag: 'ZOHO_ENABLED',
    requiredEnv: ['ZOHO_CLIENT_ID', 'ZOHO_CLIENT_SECRET'], run: syncZoho,
  },
  {
    key: 'accounts_sheet', name: 'Accounts sheet (Google Sheets)', feeds: 'Cashflow (invoices, collections, receivables ageing)', envFlag: 'ACCOUNTS_SHEET_ENABLED',
    requiredEnv: [], run: syncAccountsSheet,
  },
  {
    key: 'meta', name: 'Meta Ads', feeds: 'Marketing (campaign spend, reach, leads per month)', envFlag: 'META_ENABLED',
    requiredEnv: ['META_ACCESS_TOKEN', 'META_AD_ACCOUNT_IDS'], run: syncMeta,
  },
  {
    key: 'google_ads', name: 'Google Ads', feeds: 'Marketing (campaign cost, clicks, conversions per month)', envFlag: 'GOOGLE_ADS_ENABLED',
    requiredEnv: ['GOOGLE_ADS_DEVELOPER_TOKEN', 'GOOGLE_ADS_CLIENT_ID', 'GOOGLE_ADS_CLIENT_SECRET', 'GOOGLE_ADS_REFRESH_TOKEN', 'GOOGLE_ADS_CUSTOMER_IDS'], run: syncGoogleAds,
  },
  {
    key: 'linkedin', name: 'LinkedIn Ads', feeds: 'Marketing (campaign cost, clicks, lead-gen forms per month)', envFlag: 'LINKEDIN_ENABLED',
    requiredEnv: ['LINKEDIN_ACCESS_TOKEN', 'LINKEDIN_AD_ACCOUNT_IDS'], run: syncLinkedIn,
  },
];

/**
 * An integration is enabled when its flag is "true", or — when the flag is not set at all — as soon as its keys exist.
 * Zoho additionally needs the "Connect Zoho" step (refresh token in the database or ZOHO_REFRESH_TOKEN).
 */
export async function integrationStatus(i: Integration) {
  const flag = process.env[i.envFlag];
  const missing = i.requiredEnv.filter((k) => !process.env[k]);
  const enabled = flag === 'true' || (flag === undefined && missing.length === 0);
  let connected = true;
  if (i.key === 'zoho') connected = !!(await zohoConnection()).refreshToken;
  if (i.key === 'accounts_sheet') connected = !!(await accountsSheetConnection()).url;
  return { enabled, missing, connected, ready: enabled && missing.length === 0 && connected };
}

export async function runIntegration(i: Integration) {
  const st = await integrationStatus(i);
  if (!st.ready) {
    const msg = !st.enabled ? 'disabled' : st.missing.length ? `missing ${st.missing.join(', ')}` : 'not connected';
    await query(`INSERT INTO sync_runs (integration, status, message, finished_at) VALUES ($1, 'skipped', $2, now())`, [i.key, msg]);
    return { key: i.key, status: 'skipped', message: msg, rows: 0 };
  }
  const run = await one<{ id: number }>(`INSERT INTO sync_runs (integration) VALUES ($1) RETURNING id`, [i.key]);
  try {
    const rows = await i.run();
    await query(`UPDATE sync_runs SET status = 'ok', rows = $1, finished_at = now(), message = 'ok' WHERE id = $2`, [rows, run!.id]);
    return { key: i.key, status: 'ok', message: 'ok', rows };
  } catch (e) {
    const msg = e instanceof Error ? e.message : String(e);
    await query(`UPDATE sync_runs SET status = 'error', finished_at = now(), message = $1 WHERE id = $2`, [msg.slice(0, 1000), run!.id]);
    return { key: i.key, status: 'error', message: msg, rows: 0 };
  }
}

export async function runAllIntegrations() {
  const out = [];
  for (const i of INTEGRATIONS) out.push(await runIntegration(i));
  return out;
}

