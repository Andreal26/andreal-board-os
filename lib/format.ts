import { type Unit } from '@/types';

const inr0 = new Intl.NumberFormat('en-IN', { maximumFractionDigits: 0 });

/** ₹ amounts in Indian style: ₹12,34,567 or compact ₹12.3 L / ₹1.2 Cr. */
export function inr(v: number | null | undefined, compact = false) {
  if (v === null || v === undefined || !Number.isFinite(v)) return '—';
  if (compact) {
    const a = Math.abs(v);
    if (a >= 1e7) return `₹${(v / 1e7).toFixed(2)} Cr`;
    if (a >= 1e5) return `₹${(v / 1e5).toFixed(1)} L`;
    if (a >= 1e3) return `₹${(v / 1e3).toFixed(1)} K`;
  }
  return `₹${inr0.format(v)}`;
}

export function fmt(v: number | null | undefined, unit: Unit | 'number' = 'number', compact = true): string {
  if (v === null || v === undefined || !Number.isFinite(v)) return '—';
  switch (unit) {
    case 'currency': return inr(v, compact);
    case 'percent': return `${Number(v.toFixed(1))}%`;
    case 'days': return `${Math.round(v)} d`;
    default: return inr0.format(v);
  }
}

export function fmtField(v: unknown, type: string): string {
  if (v === null || v === undefined || v === '') return '';
  if (type === 'currency') return inr(Number(v));
  if (type === 'percent') return `${Number(Number(v).toFixed(1))}%`;
  if (type === 'number' || type === 'score') return inr0.format(Number(v));
  if (type === 'date') return fmtDate(String(v));
  return String(v);
}

export function fmtDate(s: string | null | undefined) {
  if (!s) return '';
  const d = new Date(String(s).slice(0, 10) + 'T00:00:00Z');
  if (isNaN(d.getTime())) return String(s);
  return d.toLocaleDateString('en-GB', { day: '2-digit', month: 'short', year: 'numeric', timeZone: 'UTC' });
}
