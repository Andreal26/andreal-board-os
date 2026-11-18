import { NextResponse } from 'next/server';
import { withUser, json, fail } from '@/server/route-helpers';
import { isAdmin } from '@/server/auth';
import { audit } from '@/db/client';
import { disconnectZoho } from '@/server/integrations/zoho-oauth';

export async function POST() {
  const user = await withUser(); if (user instanceof NextResponse) return user;
  if (!isAdmin(user)) return fail('Admins only', 403);
  await disconnectZoho();
  await audit(user.id, 'zoho_disconnect', 'sales', null);
  return json({ ok: true });
}
