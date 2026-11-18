import { randomBytes } from 'node:crypto';
import { getSetting, query } from '@/db/client';
import { appUrl } from '@/server/mailer';

/**
 * Zoho OAuth ("Connect Zoho" button).
 * Only ZOHO_CLIENT_ID / ZOHO_CLIENT_SECRET live in the Space secrets. Clicking Connect sends the admin to Zoho's
 * consent screen; Zoho redirects back to /api/integrations/zoho/callback, where the code is exchanged for a
 * long-lived refresh token that is stored in the database (never shown to anyone).
 */
export type ZohoProduct = 'crm' | 'projects';
export const ZOHO_PRODUCTS: ZohoProduct[] = ['crm', 'projects'];
export const isZohoProduct = (v: unknown): v is ZohoProduct => v === 'crm' || v === 'projects';

/** Each product is its own connection (CRM and Projects can live in different Zoho organisations). */
const SCOPES: Record<ZohoProduct, string> = {
  crm: 'ZohoCRM.modules.deals.READ,ZohoCRM.users.READ',
  projects: 'ZohoProjects.portals.READ,ZohoProjects.projects.READ,ZohoProjects.tasks.READ',
};
const PREFIX: Record<ZohoProduct, string> = { crm: 'zoho', projects: 'zohoprojects' };

export const zohoRedirectUri = () => `${appUrl()}/api/integrations/zoho/callback`;

export interface ZohoConnection {
  clientId: string;
  clientSecret: string;
  refreshToken: string | null;
  accountsUrl: string;
  apiUrl: string;
  connectedAt: string | null;
  source: 'env' | 'database' | 'none';
}

export async function zohoConnection(product: ZohoProduct = 'crm'): Promise<ZohoConnection> {
  const k = PREFIX[product];
  const envToken = (product === 'crm' ? process.env.ZOHO_REFRESH_TOKEN : process.env.ZOHO_PROJECTS_REFRESH_TOKEN) || null;
  const dbToken = envToken ? null : await getSetting(`${k}_refresh_token`);
  const accounts = (await getSetting(`${k}_accounts_url`)) || process.env.ZOHO_ACCOUNTS_URL || 'https://accounts.zoho.in';
  const api = (await getSetting(`${k}_api_domain`)) || process.env.ZOHO_API_URL || 'https://www.zohoapis.in';
  return {
    clientId: process.env.ZOHO_CLIENT_ID || '',
    clientSecret: process.env.ZOHO_CLIENT_SECRET || '',
    refreshToken: envToken || dbToken,
    accountsUrl: accounts.replace(/\/$/, ''),
    apiUrl: api.replace(/\/$/, ''),
    connectedAt: await getSetting(`${k}_connected_at`),
    source: envToken ? 'env' : dbToken ? 'database' : 'none',
  };
}

/** Fresh access token for a connected product. */
export async function zohoAccessToken(product: ZohoProduct = 'crm') {
  const conn = await zohoConnection(product);
  if (!conn.refreshToken) throw new Error(`Zoho ${product === 'crm' ? 'CRM' : 'Projects'} is not connected yet — use the Connect button in Settings`);
  const res = await fetch(`${conn.accountsUrl}/oauth/v2/token?` + new URLSearchParams({
    refresh_token: conn.refreshToken,
    client_id: conn.clientId,
    client_secret: conn.clientSecret,
    grant_type: 'refresh_token',
  }), { method: 'POST', cache: 'no-store' });
  const body = await res.json().catch(() => ({}));
  if (!body.access_token) throw new Error(`Zoho token error: ${JSON.stringify(body).slice(0, 200)}`);
  return body.access_token as string;
}

export function zohoAuthorizeUrl(state: string, product: ZohoProduct = 'crm') {
  const accounts = (process.env.ZOHO_ACCOUNTS_URL || 'https://accounts.zoho.in').replace(/\/$/, '');
  return `${accounts}/oauth/v2/auth?` + new URLSearchParams({
    scope: SCOPES[product],
    client_id: process.env.ZOHO_CLIENT_ID || '',
    response_type: 'code',
    access_type: 'offline',
    prompt: 'consent',
    redirect_uri: zohoRedirectUri(),
    state,
  });
}

export const newState = () => randomBytes(16).toString('hex');

/** Exchange the authorization code for tokens and store the refresh token. */
export async function completeZohoConnect(code: string, accountsServer?: string | null, product: ZohoProduct = 'crm') {
  const accounts = (accountsServer && /^https:\/\/accounts\.zoho\.[a-z.]+$/.test(accountsServer)
    ? accountsServer
    : process.env.ZOHO_ACCOUNTS_URL || 'https://accounts.zoho.in').replace(/\/$/, '');
  const res = await fetch(`${accounts}/oauth/v2/token`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: new URLSearchParams({
      grant_type: 'authorization_code',
      client_id: process.env.ZOHO_CLIENT_ID || '',
      client_secret: process.env.ZOHO_CLIENT_SECRET || '',
      redirect_uri: zohoRedirectUri(),
      code,
    }),
    cache: 'no-store',
  });
  const body = await res.json().catch(() => ({}));
  if (!res.ok || !body.refresh_token) {
    throw new Error(`Zoho did not return a refresh token (${res.status} ${body.error ?? ''}). Check the client id/secret and the redirect URI.`);
  }
  const set = (key: string, value: string) =>
    query(`INSERT INTO app_settings (key, value) VALUES ($1, $2) ON CONFLICT (key) DO UPDATE SET value = EXCLUDED.value`, [key, value]);
  const k = PREFIX[product];
  await set(`${k}_refresh_token`, body.refresh_token);
  await set(`${k}_accounts_url`, accounts);
  if (body.api_domain) await set(`${k}_api_domain`, body.api_domain);
  await set(`${k}_connected_at`, new Date().toISOString());
}

export async function disconnectZoho(product: ZohoProduct = 'crm') {
  const k = PREFIX[product];
  await query(`DELETE FROM app_settings WHERE key IN ($1, $2, $3, $4)`, [`${k}_refresh_token`, `${k}_connected_at`, `${k}_api_domain`, `${k}_accounts_url`]);
}
