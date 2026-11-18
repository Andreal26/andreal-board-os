import { NextResponse } from 'next/server';
import { cookies } from 'next/headers';
import { currentUser, isAdmin } from '@/server/auth';
import { newState, zohoAuthorizeUrl } from '@/server/integrations/zoho-oauth';

/** Admin clicks "Connect Zoho" → redirect to Zoho's consent screen. */
export async function GET(req: Request) {
  const user = await currentUser();
  if (!user || !isAdmin(user)) return NextResponse.redirect(new URL('/login', req.url));
  if (!process.env.ZOHO_CLIENT_ID || !process.env.ZOHO_CLIENT_SECRET) {
    return NextResponse.redirect(new URL('/settings?zoho=missing-keys', req.url));
  }
  const state = newState();
  (await cookies()).set('zoho_oauth_state', state, {
    httpOnly: true, secure: process.env.NODE_ENV === 'production', sameSite: 'lax', path: '/', maxAge: 600,
  });
  return NextResponse.redirect(zohoAuthorizeUrl(state));
}
