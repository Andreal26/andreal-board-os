/**
 * Built-in scheduler timetable (India time, 24h). Override with env vars:
 *   SCHEDULE_SYNC=06:00  SCHEDULE_SNAPSHOT=06:30  SCHEDULE_ALERTS=08:30  SCHEDULE_WEEKLY=MON 09:00
 */
export interface JobDef { job: 'sync' | 'snapshot' | 'alerts' | 'weekly'; label: string; hh: number; mm: number; weekday?: number }

export const DAYS = ['SUN', 'MON', 'TUE', 'WED', 'THU', 'FRI', 'SAT'];

function parse(v: string | undefined, fallback: string) {
  const s = (v || fallback).trim().toUpperCase();
  const m = s.match(/^(?:(SUN|MON|TUE|WED|THU|FRI|SAT)\s+)?(\d{1,2}):(\d{2})$/);
  const f = fallback.toUpperCase().match(/^(?:(SUN|MON|TUE|WED|THU|FRI|SAT)\s+)?(\d{1,2}):(\d{2})$/)!;
  const r = m ?? f;
  return { weekday: r[1] ? DAYS.indexOf(r[1]) : undefined, hh: Number(r[2]), mm: Number(r[3]) };
}

export function jobDefs(): JobDef[] {
  return [
    { job: 'sync', label: 'Sync integrations', ...parse(process.env.SCHEDULE_SYNC, '06:00') },
    { job: 'snapshot', label: 'KPI snapshot', ...parse(process.env.SCHEDULE_SNAPSHOT, '06:30') },
    { job: 'alerts', label: 'Alert digest email', ...parse(process.env.SCHEDULE_ALERTS, '08:30') },
    { job: 'weekly', label: 'Weekly board pack email', ...parse(process.env.SCHEDULE_WEEKLY, 'MON 09:00') },
  ];
}

