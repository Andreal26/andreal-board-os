/**
 * Seed script (local use).
 *   npm run db:seed                  → creates schema + admin, loads the 9 real R&D initiatives from the board workbook
 *   npm run db:demo                  → also loads clearly-marked demo rows (source = "demo")
 *   npm run db:seed -- --clear-demo  → removes all demo rows
 * Stop `npm run dev` first when using the built-in database (it allows one process at a time).
 * On the Hugging Face Space, use Settings → "Load demo data" / "Clear demo data" instead.
 */
import { query } from '@/db/client';
import { seedRnd, seedDemo, clearDemo, demoCount } from '@/server/seed';

const args = process.argv.slice(2);

async function main() {
  await query('SELECT 1'); // creates schema + first admin
  if (args.includes('--clear-demo')) {
    console.log(`✓ Removed ${await clearDemo()} demo rows`);
    return;
  }
  await seedRnd();
  if (args.includes('--demo')) {
    const n = await demoCount();
    if (n > 0) console.log(`• Demo data already present (${n} rows) — skipped. Use --clear-demo first to reload.`);
    else await seedDemo();
  }
  console.log('Done.');
}

main().then(() => process.exit(0)).catch((e) => { console.error(e); process.exit(1); });
