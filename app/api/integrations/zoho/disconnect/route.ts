import { NextResponse } from 'next/server';
import { withUser, json, fail } from '@/server/route-helpers';
import { isAdmin } from '@/server/auth';
import { audit } from '@/db/client';
import { disconnectZoho, isZohoProduct } from '@/server/integrations/zoho-oauth';

export async function POST(req: Request) {
  const user = await withUser(); if (user instanceof NextResponse) return user;
  if (!isAdmin(user)) return fail('Admins only', 403);
  const p = new URL(req.url).searchParams.get('product');
  const product = isZohoProduct(p) ? p : 'crm';
  await disconnectZoho(product);
  await audit(user.id, product === 'crm' ? 'zoho_disconnect' : 'zoho_projects_disconnect', product === 'crm' ? 'sales' : 'operations', null);
  return json({ ok: true });
}
