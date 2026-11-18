import { NextResponse } from 'next/server';
import { withUser, json, fail } from '@/server/route-helpers';
import { isAdmin } from '@/server/auth';
import { zohoProjectsRaw, zohoProjectsSample } from '@/server/integrations/zoho-projects';

/** Admin-only: portals + raw fields of a few projects, to check the field mapping. */
export async function GET(req: Request) {
  const user = await withUser(); if (user instanceof NextResponse) return user;
  if (!isAdmin(user)) return fail('Admins only', 403);
  try {
    const q = new URL(req.url).searchParams;
    if (q.get('raw')) return json(await zohoProjectsRaw(q.get('raw')!));
    return json(await zohoProjectsSample(q.get('project')));
  } catch (e) {
    return fail(e instanceof Error ? e.message : String(e), 502);
  }
}
