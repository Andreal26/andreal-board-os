/**
 * Reporting periods. Financial year runs April → March (Indian FY).
 */
import type { Period, PeriodKey } from '@/types';

export type { Period, PeriodKey } from '@/types';

export const PERIODS: { key: PeriodKey; label: string }[] = [
  { key: 'WTD', label: 'Week to date' },
  { key: 'MTD', label: 'Month to date' },
  { key: 'LM', label: 'Last month' },
  { key: 'QTD', label: 'Quarter to date' },
  { key: 'FYTD', label: 'FY to date' },
  { key: 'ALL', label: 'All time' },
];

const ymd = (d: Date) => d.toISOString().slice(0, 10);
const utc = (y: number, m: number, d: number) => new Date(Date.UTC(y, m, d));

export function today(): Date {
  const n = new Date();
  return utc(n.getFullYear(), n.getMonth(), n.getDate());
}

export function fyStartYear(d: Date) {
  return d.getUTCMonth() >= 3 ? d.getUTCFullYear() : d.getUTCFullYear() - 1;
}

export function fyLabel(d: Date) {
  const y = fyStartYear(d);
  return `FY ${y}-${String((y + 1) % 100).padStart(2, '0')}`;
}

export function resolvePeriod(key: string | undefined | null, ref: Date = today()): Period {
  const k = (PERIODS.find((p) => p.key === key)?.key ?? 'MTD') as PeriodKey;
  const label = PERIODS.find((p) => p.key === k)!.label;
  const y = ref.getUTCFullYear();
  const m = ref.getUTCMonth();
  let start: Date;
  let end: Date = ref;
  switch (k) {
    case 'WTD': {
      const dow = (ref.getUTCDay() + 6) % 7; // Monday = 0
      start = utc(y, m, ref.getUTCDate() - dow);
      break;
    }
    case 'MTD':
      start = utc(y, m, 1);
      break;
    case 'LM':
      start = utc(y, m - 1, 1);
      end = utc(y, m, 0);
      break;
    case 'QTD': {
      const fyMonth = (m - 3 + 12) % 12; // 0 = April
      const qStartFy = Math.floor(fyMonth / 3) * 3;
      start = utc(y, m - (fyMonth - qStartFy), 1);
      break;
    }
    case 'FYTD':
      start = utc(fyStartYear(ref), 3, 1);
      break;
    default:
      start = utc(2000, 0, 1);
  }
  return { key: k, label, start: ymd(start), end: ymd(end) };
}

export function inPeriod(date: unknown, p: Period) {
  if (!date) return false;
  const s = String(date).slice(0, 10);
  return s >= p.start && s <= p.end;
}

/** Months (YYYY-MM) overlapping a period, with the fraction of each month inside it. */
export function monthsIn(p: Period): { month: string; fraction: number }[] {
  if (p.key === 'ALL') return [];
  const out: { month: string; fraction: number }[] = [];
  const s = new Date(p.start + 'T00:00:00Z');
  const e = new Date(p.end + 'T00:00:00Z');
  let cur = utc(s.getUTCFullYear(), s.getUTCMonth(), 1);
  while (cur <= e) {
    const mStart = cur;
    const mEnd = utc(cur.getUTCFullYear(), cur.getUTCMonth() + 1, 0);
    const days = mEnd.getUTCDate();
    const a = mStart < s ? s : mStart;
    const b = mEnd > e ? e : mEnd;
    const inside = Math.round((b.getTime() - a.getTime()) / 86400000) + 1;
    out.push({ month: ymd(mStart).slice(0, 7), fraction: Math.max(0, Math.min(1, inside / days)) });
    cur = utc(cur.getUTCFullYear(), cur.getUTCMonth() + 1, 1);
  }
  return out;
}

export function currentMonth() {
  return ymd(today()).slice(0, 7);
}

export function shiftMonth(month: string, delta: number) {
  const [y, m] = month.split('-').map(Number);
  return ymd(utc(y, m - 1 + delta, 1)).slice(0, 7);
}
