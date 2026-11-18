import { NextResponse } from 'next/server';
import { cookies } from 'next/headers';
import { currentUser, isAdmin } from '@/server/auth';
import { isZohoProduct, newState, zohoAuthorizeUrl } from '@/server/integrations/zoho-oauth';

/** Admin clicks "Connect Zoho" / "Connect Zoho Projects" (?product=projects) → Zoho's consent screen. */
export async function GET(req: Request) {
  const user = await currentUser();
  if (!user || !isAdmin(user)) return NextResponse.redirect(new URL('/login', req.url));
  const p = new URL(req.url).searchParams.get('product');
  const product = isZohoProduct(p) ? p : 'crm';
  if (!process.env.ZOHO_CLIENT_ID || !process.env.ZOHO_CLIENT_SECRET) {
    return NextResponse.redirect(new URL('/settings?zoho=missing-keys', req.url));
  }
  const state = newState();
  (await cookies()).set('zoho_oauth_state', `${product}:${state}`, {
    httpOnly: true, secure: process.env.NODE_ENV === 'production', sameSite: 'lax', path: '/', maxAge: 600,
  });
  return NextResponse.redirect(zohoAuthorizeUrl(`${product}:${state}`, product));
}
