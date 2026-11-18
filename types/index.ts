/**
 * Shared domain types — imported by config, server and UI code.
 */
import type { ListName } from '@/config/lists';

// ── Organisation ─────────────────────────────────────────────
export type Company = 'Andreal' | 'Anderson';
export type CompanyFilter = 'All' | Company;
export type Role = 'admin' | 'ceo' | 'owner' | 'viewer';

export type DeptKey = 'operations' | 'sales' | 'marketing' | 'hr' | 'cashflow' | 'rnd';

export interface User {
  id: number;
  email: string;
  name: string;
  role: Role;
  departments: DeptKey[];
  company: CompanyFilter;
  active: boolean;
}

// ── Department records ───────────────────────────────────────
export type FieldType = 'text' | 'textarea' | 'number' | 'currency' | 'percent' | 'date' | 'select' | 'score';

/** One row's values, keyed by field key (stored as JSONB). */
export type RecordData = Record<string, any>;

export interface Field {
  key: string;
  label: string;
  type: FieldType;
  list?: ListName;
  required?: boolean;
  /** Calculated from other fields; read-only. */
  compute?: (r: RecordData) => number | string | null;
  /** Show as a column in the department table. */
  col?: boolean;
  /** Form section. */
  group: string;
  help?: string;
  /** For score fields: max value. */
  max?: number;
}

export interface DeptConfig {
  key: DeptKey;
  name: string;
  short: string;
  purpose: string;
  /** Field shown as the row title. */
  titleField: string;
  /** Main date used for period filtering. */
  dateField: string;
  groups: string[];
  fields: Field[];
}

export interface DeptRecord {
  id: number;
  dept: DeptKey;
  company: Company;
  data: RecordData;
  source: string;
  external_id: string | null;
  created_at: string;
  updated_at: string;
}

// ── Periods ──────────────────────────────────────────────────
export type PeriodKey = 'WTD' | 'MTD' | 'QTD' | 'FYTD' | 'LM' | 'ALL';

export interface Period {
  key: PeriodKey;
  label: string;
  start: string; // YYYY-MM-DD inclusive
  end: string; // YYYY-MM-DD inclusive
}

// ── KPIs ─────────────────────────────────────────────────────
export type Unit = 'count' | 'currency' | 'percent' | 'days';
/** All records of every department, as loaded for the KPI engine. */
export type BoardData = Record<DeptKey, RecordData[]>;
export type KpiValues = Record<string, number | null>;

export interface Metric {
  id: string;
  label: string;
  dept: DeptKey;
  unit: Unit;
  kind: 'flow' | 'stock';
  better: 'higher' | 'lower';
  /** How monthly targets combine across a period: summed (pro-rated) or averaged. */
  agg: 'sum' | 'avg';
  help: string;
  compute: (d: BoardData, p: Period) => number | null;
}

/** Target attainment status. */
export type Status = 'good' | 'watch' | 'bad' | 'none';
/** Department health. */
export type Rag = 'Green' | 'Amber' | 'Red' | 'No data';

// ── Alerts ───────────────────────────────────────────────────
export type Severity = 'high' | 'medium' | 'low';

export interface Alert {
  rule: string;
  severity: Severity;
  dept: DeptKey;
  company: string;
  recordId: number;
  title: string;
  message: string;
  owner?: string;
}
