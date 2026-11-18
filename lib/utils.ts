/** Small pure helpers shared across the app. */

/** Parse a number from user input ("₹2,50,000", "85%", 1200) — null when blank or invalid. */
export const num = (v: unknown): number | null => {
  if (v === null || v === undefined || v === '') return null;
  const n = typeof v === 'number' ? v : Number(String(v).replace(/[₹,\s%]/g, ''));
  return Number.isFinite(n) ? n : null;
};

/** Like num() but 0 when blank. */
export const n0 = (v: unknown) => num(v) ?? 0;

export const round = (v: number, dp = 2) => Math.round(v * 10 ** dp) / 10 ** dp;

/** a ÷ b (×100 for percentages); null when b is 0/blank. */
export const ratio = (a: unknown, b: unknown, pct = true) => {
  const d = num(b);
  const x = num(a);
  if (!d || x === null) return null;
  return round((x / d) * (pct ? 100 : 1));
};

/** YYYY-MM-DD (or ISO) → UTC midnight Date. */
export const toDate = (v: unknown): Date | null => {
  if (!v) return null;
  const s = String(v).slice(0, 10);
  const d = new Date(s + 'T00:00:00Z');
  return isNaN(d.getTime()) ? null : d;
};

export const todayUTC = () => {
  const n = new Date();
  return new Date(Date.UTC(n.getFullYear(), n.getMonth(), n.getDate()));
};

export const daysBetween = (a: Date, b: Date) => Math.round((b.getTime() - a.getTime()) / 86400000);

/** Days until a date (negative = overdue). */
export function daysFromToday(v: unknown): number | null {
  const d = toDate(v);
  return d ? daysBetween(todayUTC(), d) : null;
}

/** ₹ in lakh / crore shorthand for messages: 12.5 L, 1.2 Cr. */
export function fmtLakh(v: number) {
  if (Math.abs(v) >= 1e7) return `${round(v / 1e7, 2)} Cr`;
  if (Math.abs(v) >= 1e5) return `${round(v / 1e5, 2)} L`;
  return v.toLocaleString('en-IN');
}

export function escapeHtml(s: string) {
  return s.replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[c]!);
}
