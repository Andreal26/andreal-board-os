import { DEPARTMENTS, optionsFor } from '@/config/departments';
import { num } from '@/lib/utils';
import type { Company, DeptKey, RecordData } from '@/types';

/**
 * Input cleaning and validation for department records — used by the forms API, CSV import,
 * integrations and the seed script. Pure (no database access), so it also runs in tests.
 */
/** Parse many date spellings (ISO, dd/mm/yyyy, dd-mm-yyyy, Excel serial) into YYYY-MM-DD. */
export function parseDate(v: unknown): string | null {
  if (v === null || v === undefined || v === '') return null;
  if (v instanceof Date && !isNaN(v.getTime())) return v.toISOString().slice(0, 10);
  const s = String(v).trim();
  let m = s.match(/^(\d{4})-(\d{1,2})-(\d{1,2})/);
  if (m) return iso(+m[1], +m[2], +m[3]);
  m = s.match(/^(\d{1,2})[/.-](\d{1,2})[/.-](\d{2,4})$/); // Indian dd/mm/yyyy
  if (m) {
    const y = +m[3] < 100 ? 2000 + +m[3] : +m[3];
    return iso(y, +m[2], +m[1]);
  }
  if (/^\d{5}$/.test(s)) {
    const d = new Date(Date.UTC(1899, 11, 30) + Number(s) * 86400000); // Excel serial
    return d.toISOString().slice(0, 10);
  }
  const d = new Date(s);
  return isNaN(d.getTime()) ? null : d.toISOString().slice(0, 10);
}
function iso(y: number, mo: number, d: number) {
  if (mo < 1 || mo > 12 || d < 1 || d > 31) return null;
  return `${y}-${String(mo).padStart(2, '0')}-${String(d).padStart(2, '0')}`;
}

export interface NormalizeResult {
  data: RecordData;
  company: Company | null;
  errors: string[];
}

/** Clean and validate raw input (form JSON or a CSV row keyed by field key OR label). */
export function normalize(dept: DeptKey, raw: Record<string, unknown>): NormalizeResult {
  const cfg = DEPARTMENTS[dept];
  const data: RecordData = {};
  const errors: string[] = [];
  const byLabel = new Map<string, unknown>();
  for (const [k, v] of Object.entries(raw)) byLabel.set(k.trim().toLowerCase(), v);

  for (const f of cfg.fields) {
    if (f.compute) continue;
    let v = raw[f.key];
    if (v === undefined) v = byLabel.get(f.label.toLowerCase());
    if (typeof v === 'string') v = v.trim();
    if (v === undefined || v === null || v === '') {
      if (f.required) errors.push(`${f.label} is required`);
      continue;
    }
    switch (f.type) {
      case 'number':
      case 'currency':
      case 'percent':
      case 'score': {
        const n = num(v);
        if (n === null) {
          errors.push(`${f.label}: "${v}" is not a number`);
          break;
        }
        let val = n;
        // Percent typed as a fraction (0.85) → 85
        if (f.type === 'percent' && typeof v !== 'string' && n > 0 && n <= 1) val = n * 100;
        if (f.type === 'percent' && typeof v === 'string' && !v.includes('%') && n > 0 && n < 1) val = n * 100;
        if (f.type === 'score' && f.max) val = Math.max(0, Math.min(f.max, n));
        data[f.key] = val;
        break;
      }
      case 'date': {
        const d = parseDate(v);
        if (!d) errors.push(`${f.label}: "${v}" is not a valid date`);
        else data[f.key] = d;
        break;
      }
      case 'select': {
        const opts = optionsFor(f) ?? [];
        const hit = opts.find((o) => o.toLowerCase() === String(v).toLowerCase());
        if (!hit) errors.push(`${f.label}: "${v}" must be one of ${opts.join(', ')}`);
        else data[f.key] = hit;
        break;
      }
      default:
        data[f.key] = String(v);
    }
  }
  const company = (data.company as NormalizeResult['company']) ?? null;
  return { data, company, errors };
}

