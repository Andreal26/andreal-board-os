import Papa from 'papaparse';
import { withUser, deptOr404, json, fail } from '@/server/route-helpers';
import { canEditDept } from '@/server/auth';
import { createRecord } from '@/server/records';
import { normalize } from '@/lib/validation';
import { NextResponse } from 'next/server';

type Ctx = { params: Promise<{ dept: string }> };

/** CSV import. Headers may be field labels (as in the template / old workbook) or field keys. ?dryRun=1 validates only. */
export async function POST(req: Request, ctx: Ctx) {
  const user = await withUser(); if (user instanceof NextResponse) return user;
  const dept = deptOr404((await ctx.params).dept); if (dept instanceof NextResponse) return dept;
  if (!canEditDept(user, dept)) return fail('Not allowed', 403);
  const dryRun = new URL(req.url).searchParams.get('dryRun') === '1';

  let text = '';
  const ct = req.headers.get('content-type') || '';
  if (ct.includes('multipart/form-data')) {
    const form = await req.formData();
    const file = form.get('file');
    if (!(file instanceof File)) return fail('Attach a CSV file as "file"');
    text = await file.text();
  } else {
    text = await req.text();
  }
  const parsed = Papa.parse<Record<string, string>>(text.replace(/^﻿/, ''), { header: true, skipEmptyLines: 'greedy' });
  const rows = parsed.data.filter((r) => Object.values(r).some((v) => String(v ?? '').trim()));
  if (!rows.length) return fail('No data rows found');

  const problems: { row: number; errors: string[] }[] = [];
  const valid: Record<string, unknown>[] = [];
  rows.forEach((raw, i) => {
    const { data, company, errors } = normalize(dept, raw);
    if (user.company !== 'All' && company && company !== user.company) errors.push(`Company must be ${user.company}`);
    if (errors.length) problems.push({ row: i + 2, errors });
    else valid.push(data);
  });
  if (!dryRun) for (const data of valid) await createRecord(dept, data, user.id, 'import');
  return json({ total: rows.length, imported: dryRun ? 0 : valid.length, valid: valid.length, problems: problems.slice(0, 200), dryRun });
}
