import { NextResponse } from 'next/server';
import { cookies } from 'next/headers';
import { currentUser, isAdmin } from '@/server/auth';
import { audit } from '@/db/client';
import { completeZohoConnect } from '@/server/integrations/zoho-oauth';
import { appUrl } from '@/server/mailer';

/** Zoho redirects here after consent: exchange the code, store the refresh token, back to Settings. */
export async function GET(req: Request) {
  const url = new URL(req.url);
  const back = (q: string) => NextResponse.redirect(`${appUrl()}/settings?zoho=${q}`);
  const user = await currentUser();
  if (!user || !isAdmin(user)) return NextResponse.redirect(`${appUrl()}/login`);
  const jar = await cookies();
  const expected = jar.get('zoho_oauth_state')?.value;
  jar.delete('zoho_oauth_state');
  if (url.searchParams.get('error')) return back('denied');
  const code = url.searchParams.get('code');
  if (!code || !expected || url.searchParams.get('state') !== expected) return back('bad-state');
  try {
    await completeZohoConnect(code, url.searchParams.get('accounts-server'));
    await audit(user.id, 'zoho_connect', 'sales', null);
    return back('connected');
  } catch (e) {
    console.error('[zoho] connect failed:', e instanceof Error ? e.message : e);
    return back('failed');
  }
}
