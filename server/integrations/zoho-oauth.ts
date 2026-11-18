import { randomBytes } from 'node:crypto';
import { getSetting, query } from '@/db/client';
import { appUrl } from '@/server/mailer';

/**
 * Zoho OAuth ("Connect Zoho" button).
 * Only ZOHO_CLIENT_ID / ZOHO_CLIENT_SECRET live in the Space secrets. Clicking Connect sends the admin to Zoho's
 * consent screen; Zoho redirects back to /api/integrations/zoho/callback, where the code is exchanged for a
 * long-lived refresh token that is stored in the database (never shown to anyone).
 */
const SCOPES = 'ZohoCRM.modules.deals.READ,ZohoCRM.users.READ';

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

export async function zohoConnection(): Promise<ZohoConnection> {
  const envToken = process.env.ZOHO_REFRESH_TOKEN || null;
  const dbToken = envToken ? null : await getSetting('zoho_refresh_token');
  const accounts = (await getSetting('zoho_accounts_url')) || process.env.ZOHO_ACCOUNTS_URL || 'https://accounts.zoho.in';
  const api = (await getSetting('zoho_api_domain')) || process.env.ZOHO_API_URL || 'https://www.zohoapis.in';
  return {
    clientId: process.env.ZOHO_CLIENT_ID || '',
    clientSecret: process.env.ZOHO_CLIENT_SECRET || '',
    refreshToken: envToken || dbToken,
    accountsUrl: accounts.replace(/\/$/, ''),
    apiUrl: api.replace(/\/$/, ''),
    connectedAt: await getSetting('zoho_connected_at'),
    source: envToken ? 'env' : dbToken ? 'database' : 'none',
  };
}

export function zohoAuthorizeUrl(state: string) {
  const accounts = (process.env.ZOHO_ACCOUNTS_URL || 'https://accounts.zoho.in').replace(/\/$/, '');
  return `${accounts}/oauth/v2/auth?` + new URLSearchParams({
    scope: SCOPES,
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
export async function completeZohoConnect(code: string, accountsServer?: string | null) {
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
  await set('zoho_refresh_token', body.refresh_token);
  await set('zoho_accounts_url', accounts);
  if (body.api_domain) await set('zoho_api_domain', body.api_domain);
  await set('zoho_connected_at', new Date().toISOString());
}

export async function disconnectZoho() {
  await query(`DELETE FROM app_settings WHERE key IN ('zoho_refresh_token', 'zoho_connected_at', 'zoho_api_domain', 'zoho_accounts_url')`);
}
