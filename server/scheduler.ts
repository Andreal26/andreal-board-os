import { query } from '@/db/client';
import { DAYS, jobDefs, type JobDef } from '@/config/schedule';

export { jobDefs } from '@/config/schedule';

/**
 * Built-in scheduler (runs inside the Hugging Face Space). Checks every minute; each job runs once per day
 * at/after its time in config/schedule.ts. If the Space restarts after the time, the job catches up the same day.
 * Set SCHEDULER_ENABLED=false to switch it off.
 */
/** Current time in India (no DST). */
export function nowIST() {
  const d = new Date(Date.now() + 330 * 60000);
  return { date: d.toISOString().slice(0, 10), hh: d.getUTCHours(), mm: d.getUTCMinutes(), weekday: d.getUTCDay() };
}

export async function recordJob(job: string, status: string, message: string, markRun = true) {
  const today = nowIST().date;
  await query(
    `INSERT INTO job_state (job, last_run_on, last_status, last_message, updated_at) VALUES ($1, $2, $3, $4, now())
     ON CONFLICT (job) DO UPDATE SET last_run_on = CASE WHEN $5 THEN $2 ELSE job_state.last_run_on END,
       last_status = $3, last_message = $4, updated_at = now()`,
    [job, markRun ? today : null, status, message.slice(0, 1000), markRun],
  );
}

export async function jobStates() {
  return query<{ job: string; last_run_on: string | null; last_status: string | null; last_message: string | null; updated_at: string }>(`SELECT * FROM job_state`);
}

async function runJob(job: JobDef['job']) {
  switch (job) {
    case 'sync': {
      const { runAllIntegrations } = await import('@/server/integrations');
      const r = await runAllIntegrations();
      return r.map((x) => `${x.key}:${x.status}`).join(' ');
    }
    case 'snapshot': {
      const { takeSnapshot } = await import('@/server/snapshots');
      return `snapshot ${(await takeSnapshot()).date}`;
    }
    case 'alerts': {
      const { runAlerts } = await import('@/server/alerts');
      const r = await runAlerts();
      return `${r.count} alerts; ${r.results.join('; ')}`;
    }
    case 'weekly': {
      const { sendWeeklyPack } = await import('@/server/weekly-pack');
      return (await sendWeeklyPack()).info;
    }
  }
}

let running = false;

export async function tick() {
  if (running) return;
  running = true;
  try {
    const now = nowIST();
    const states = new Map((await jobStates()).map((s) => [s.job, s]));
    for (const def of jobDefs()) {
      if (def.weekday !== undefined && def.weekday !== now.weekday) continue;
      const due = now.hh > def.hh || (now.hh === def.hh && now.mm >= def.mm);
      if (!due || states.get(def.job)?.last_run_on === now.date) continue;
      try {
        const msg = await runJob(def.job);
        await recordJob(def.job, 'ok', msg ?? 'ok');
        console.log(`[scheduler] ${def.job} ok — ${msg}`);
      } catch (e) {
        const msg = e instanceof Error ? e.message : String(e);
        await recordJob(def.job, 'error', msg);
        console.error(`[scheduler] ${def.job} failed — ${msg}`);
      }
    }
  } finally {
    running = false;
  }
}

const g = globalThis as unknown as { __boardScheduler?: NodeJS.Timeout };

export function startScheduler() {
  if (process.env.SCHEDULER_ENABLED === 'false' || g.__boardScheduler) return;
  g.__boardScheduler = setInterval(() => { tick().catch((e) => console.error('[scheduler]', e)); }, 60_000);
  setTimeout(() => { tick().catch((e) => console.error('[scheduler]', e)); }, 15_000);
  console.log('[scheduler] started (India time):', jobDefs().map((d) => `${d.job}@${d.weekday !== undefined ? DAYS[d.weekday] + ' ' : ''}${String(d.hh).padStart(2, '0')}:${String(d.mm).padStart(2, '0')}`).join(', '));
}
