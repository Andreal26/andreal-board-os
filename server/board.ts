import { query } from '@/db/client';
import { loadAll } from '@/server/records';
import { DEPT_KEYS, type DeptKey } from '@/config/departments';
import { resolvePeriod, type Period } from '@/lib/periods';
import { ceoQuestions, chartData, computeAll, deptHealth, loadTargets } from '@/server/kpi-engine';
import { type BoardData as Data, type KpiValues, type Rag } from '@/types';
import type { CompanyFilter } from '@/config/lists';

export interface DeptNote {
  dept: DeptKey; status: string | null; major_risk: string | null; decision_needed: string | null;
  owner: string | null; deadline: string | null; notes: string | null; updated_at: string | null;
}

export interface Board {
  company: CompanyFilter;
  period: Period;
  data: Data;
  kpis: KpiValues;
  targets: KpiValues;
  health: Record<DeptKey, { rag: Rag; reason: string }>;
  notes: Record<string, DeptNote>;
  questions: ReturnType<typeof ceoQuestions>;
  charts: ReturnType<typeof chartData>;
}

/** Everything the board views need, computed once per request. */
export async function getBoard(company: CompanyFilter, periodKey?: string | null): Promise<Board> {
  const period = resolvePeriod(periodKey);
  const [data, targets, noteRows] = await Promise.all([
    loadAll(company),
    loadTargets(company, period),
    query<DeptNote>(`SELECT * FROM dept_notes`),
  ]);
  const kpis = computeAll(data, period);
  const health = Object.fromEntries(DEPT_KEYS.map((d) => [d, deptHealth(d, data, kpis, targets)])) as Board['health'];
  const notes = Object.fromEntries(noteRows.map((n) => [n.dept, n]));
  return { company, period, data, kpis, targets, health, notes, questions: ceoQuestions(kpis, targets, health), charts: chartData(data, period) };
}
