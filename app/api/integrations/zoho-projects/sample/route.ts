import { NextResponse } from 'next/server';
import { withUser, json, fail } from '@/server/route-helpers';
import { isAdmin } from '@/server/auth';
import { zohoProjectsSample } from '@/server/integrations/zoho-projects';

/** Admin-only: portals + raw fields of a few projects, to check the field mapping. */
export async function GET() {
  const user = await withUser(); if (user instanceof NextResponse) return user;
  if (!isAdmin(user)) return fail('Admins only', 403);
  try {
    return json(await zohoProjectsSample());
  } catch (e) {
    return fail(e instanceof Error ? e.message : String(e), 502);
  }
}
