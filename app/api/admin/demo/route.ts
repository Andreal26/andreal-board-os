import { withUser, json, fail } from '@/server/route-helpers';
import { isAdmin } from '@/server/auth';
import { audit } from '@/db/client';
import { clearDemo, demoCount, seedDemo, seedRnd } from '@/server/seed';
import { NextResponse } from 'next/server';

/** Admin: load or clear demo rows (source = "demo"), or reload the workbook R&D initiatives. */
export async function POST(req: Request) {
  const user = await withUser(); if (user instanceof NextResponse) return user;
  if (!isAdmin(user)) return fail('Admins only', 403);
  const { action } = await req.json().catch(() => ({}));
  if (action === 'load') {
    if ((await demoCount()) > 0) return fail('Demo data is already loaded — clear it first');
    const n = await seedDemo();
    await audit(user.id, 'demo_load', null, null, { n });
    return json({ ok: true, message: `Loaded ${n} demo rows and demo targets for this month` });
  }
  if (action === 'clear') {
    const n = await clearDemo();
    await audit(user.id, 'demo_clear', null, null, { n });
    return json({ ok: true, message: `Removed ${n} demo rows` });
  }
  if (action === 'rnd') {
    await seedRnd();
    return json({ ok: true, message: 'Workbook R&D initiatives loaded / refreshed' });
  }
  return fail('Unknown action');
}
