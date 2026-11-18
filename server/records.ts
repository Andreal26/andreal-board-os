import { query, one, audit } from '@/db/client';
import { withComputed } from '@/config/departments';
import type { CompanyFilter, DeptKey, DeptRecord, RecordData } from '@/types';


export type { DeptRecord } from '@/types';

/** Data access for department records (JSONB rows in the `records` table). */

function hydrate(r: any): DeptRecord {
  const data = typeof r.data === 'string' ? JSON.parse(r.data) : r.data;
  return { ...r, data: withComputed(r.dept, data) };
}

export async function listRecords(dept: DeptKey, company: CompanyFilter = 'All'): Promise<DeptRecord[]> {
  const rows =
    company === 'All'
      ? await query(`SELECT * FROM records WHERE dept = $1 ORDER BY updated_at DESC, id DESC`, [dept])
      : await query(`SELECT * FROM records WHERE dept = $1 AND company = $2 ORDER BY updated_at DESC, id DESC`, [dept, company]);
  return rows.map(hydrate);
}

export async function getRecord(dept: DeptKey, id: number): Promise<DeptRecord | null> {
  const r = await one(`SELECT * FROM records WHERE dept = $1 AND id = $2`, [dept, id]);
  return r ? hydrate(r) : null;
}

export async function createRecord(dept: DeptKey, data: RecordData, userId: number | null, source = 'manual', externalId: string | null = null) {
  const r = await one<{ id: number }>(
    `INSERT INTO records (dept, company, data, source, external_id, created_by, updated_by)
     VALUES ($1, $2, $3::jsonb, $4, $5, $6, $6) RETURNING id`,
    [dept, data.company, JSON.stringify(data), source, externalId, userId],
  );
  await audit(userId, 'create', dept, r!.id, { source });
  return r!.id;
}

export async function updateRecord(dept: DeptKey, id: number, data: RecordData, userId: number | null) {
  const before = await getRecord(dept, id);
  if (!before) return false;
  await query(
    `UPDATE records SET data = $1::jsonb, company = $2, updated_by = $3, updated_at = now() WHERE id = $4 AND dept = $5`,
    [JSON.stringify(data), data.company, userId, id, dept],
  );
  const changed = Object.keys(data).filter((k) => JSON.stringify(data[k]) !== JSON.stringify(before.data[k]));
  await audit(userId, 'update', dept, id, { changed });
  return true;
}

export async function deleteRecord(dept: DeptKey, id: number, userId: number | null) {
  await query(`DELETE FROM records WHERE id = $1 AND dept = $2`, [id, dept]);
  await audit(userId, 'delete', dept, id);
}

/** Insert or update by (dept, source, external_id) — used by integrations. */
export async function upsertExternal(dept: DeptKey, source: string, externalId: string, data: RecordData) {
  await query(
    `INSERT INTO records (dept, company, data, source, external_id)
     VALUES ($1, $2, $3::jsonb, $4, $5)
     ON CONFLICT (dept, source, external_id) WHERE external_id IS NOT NULL
     DO UPDATE SET data = records.data || EXCLUDED.data, company = EXCLUDED.company, updated_at = now()`,
    [dept, data.company, JSON.stringify(data), source, externalId],
  );
}

/** All records for every department (for the KPI engine). */
export async function loadAll(company: CompanyFilter = 'All'): Promise<Record<DeptKey, RecordData[]>> {
  const rows =
    company === 'All'
      ? await query(`SELECT * FROM records`)
      : await query(`SELECT * FROM records WHERE company = $1`, [company]);
  const out: Record<DeptKey, RecordData[]> = { operations: [], sales: [], marketing: [], hr: [], cashflow: [], rnd: [] };
  for (const r of rows) {
    const h = hydrate(r);
    if (out[h.dept]) out[h.dept].push({ ...h.data, _id: h.id, _company: h.company });
  }
  return out;
}
