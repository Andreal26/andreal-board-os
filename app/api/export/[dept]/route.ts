import Papa from 'papaparse';
import { withUser, deptOr404, fail } from '@/server/route-helpers';
import { canViewDept, scopeCompany } from '@/server/auth';
import { DEPARTMENTS } from '@/config/departments';
import { listRecords } from '@/server/records';
import { NextResponse } from 'next/server';

type Ctx = { params: Promise<{ dept: string }> };

/** CSV export (?template=1 for an empty template with the right headers). */
export async function GET(req: Request, ctx: Ctx) {
  const user = await withUser(); if (user instanceof NextResponse) return user;
  const dept = deptOr404((await ctx.params).dept); if (dept instanceof NextResponse) return dept;
  if (!canViewDept(user, dept)) return fail('Not allowed', 403);
  const sp = new URL(req.url).searchParams;
  const cfg = DEPARTMENTS[dept];
  const template = sp.get('template') === '1';
  const fields = template ? cfg.fields.filter((f) => !f.compute) : cfg.fields;
  const records = template ? [] : await listRecords(dept, scopeCompany(user, sp.get('company')));
  const csv = Papa.unparse({
    fields: ['ID', ...fields.map((f) => f.label)].slice(template ? 1 : 0),
    data: records.map((r) => [r.id, ...fields.map((f) => r.data[f.key] ?? '')]),
  });
  const name = `${dept}${template ? '-template' : ''}-${new Date().toISOString().slice(0, 10)}.csv`;
  return new NextResponse('﻿' + csv, {
    headers: { 'Content-Type': 'text/csv; charset=utf-8', 'Content-Disposition': `attachment; filename="${name}"` },
  });
}
