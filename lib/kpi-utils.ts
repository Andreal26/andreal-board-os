import { round } from '@/lib/utils';
import type { Metric, Status } from '@/types';

/** Attainment vs target → status. ≥100% good, ≥85% watch, else bad (mirrored for lower-is-better). */
export function vsTarget(m: Metric, actual: number | null, target: number | null | undefined) {
  if (actual === null || target === null || target === undefined) return { status: 'none' as Status, attainment: null, variance: null };
  const variance = actual - target;
  let attainment: number | null;
  if (m.better === 'higher') attainment = target ? (actual / target) * 100 : actual >= 0 ? 100 : 0;
  else attainment = actual ? (target / actual) * 100 : 100;
  const status: Status = attainment >= 100 ? 'good' : attainment >= 85 ? 'watch' : 'bad';
  return { status, attainment: round(attainment, 0), variance };
}
