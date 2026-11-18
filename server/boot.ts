import { query } from '@/db/client';
import { seedIfEmpty } from '@/server/seed';
import { startScheduler } from '@/server/scheduler';

async function boot() {
  if (process.env.NEXT_PHASE === 'phase-production-build') return;
  try {
    await query('SELECT 1'); // schema + first admin
    await seedIfEmpty(); // workbook R&D initiatives on an empty database
    if (process.env.NODE_ENV === 'production') startScheduler();
  } catch (e) {
    console.error('[board-os] startup failed:', e);
  }
}

await boot();
