import { query } from '@/db/client';
import { json } from '@/server/route-helpers';

export const dynamic = 'force-dynamic';

export async function GET() {
  try {
    await query('SELECT 1');
    return json({ ok: true, db: process.env.DATABASE_URL ? 'postgres' : 'local' });
  } catch (e) {
    return json({ ok: false, error: e instanceof Error ? e.message : String(e) }, 500);
  }
}
