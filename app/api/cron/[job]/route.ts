import { currentUser } from '@/server/auth';
import { json, fail } from '@/server/route-helpers';
import { runAlerts } from '@/server/alerts';
import { takeSnapshot } from '@/server/snapshots';
import { runAllIntegrations } from '@/server/integrations';
import { sendWeeklyPack } from '@/server/weekly-pack';
import { recordJob } from '@/server/scheduler';

export const dynamic = 'force-dynamic';
export const maxDuration = 60;

type Ctx = { params: Promise<{ job: string }> };

/** Run a scheduled job now. Called by an admin from Settings, or by any external scheduler with "Authorization: Bearer <CRON_SECRET>". The built-in scheduler (server/scheduler.ts) runs them automatically. */
async function handle(req: Request, ctx: Ctx) {
  const auth = req.headers.get('authorization');
  const secret = process.env.CRON_SECRET;
  const viaCron = !!secret && auth === `Bearer ${secret}`;
  if (!viaCron) {
    const u = await currentUser();
    if (!u || u.role !== 'admin') return fail('Unauthorized', 401);
  }
  const job = (await ctx.params).job;
  let out: Record<string, unknown>;
  switch (job) {
    case 'sync': out = { results: await runAllIntegrations() }; break;
    case 'snapshot': out = await takeSnapshot(); break;
    case 'alerts': out = await runAlerts(); break;
    case 'weekly': out = await sendWeeklyPack(); break;
    default: return fail('Unknown job', 404);
  }
  await recordJob(job, 'ok', `manual run${viaCron ? ' (external)' : ''}`, false);
  return json({ job, ...out });
}

export const GET = handle;
export const POST = handle;
