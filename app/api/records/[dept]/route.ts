import { withUser, deptOr404, json, fail } from '@/server/route-helpers';
import { canEditDept, canViewDept, scopeCompany } from '@/server/auth';
import { createRecord, listRecords } from '@/server/records';
import { normalize } from '@/lib/validation';
import { NextResponse } from 'next/server';

type Ctx = { params: Promise<{ dept: string }> };

export async function GET(req: Request, ctx: Ctx) {
  const user = await withUser(); if (user instanceof NextResponse) return user;
  const dept = deptOr404((await ctx.params).dept); if (dept instanceof NextResponse) return dept;
  if (!canViewDept(user, dept)) return fail('Not allowed', 403);
  const company = scopeCompany(user, new URL(req.url).searchParams.get('company'));
  return json({ records: await listRecords(dept, company) });
}

export async function POST(req: Request, ctx: Ctx) {
  const user = await withUser(); if (user instanceof NextResponse) return user;
  const dept = deptOr404((await ctx.params).dept); if (dept instanceof NextResponse) return dept;
  if (!canEditDept(user, dept)) return fail('You can view but not edit this department', 403);
  const body = await req.json().catch(() => null);
  if (!body || typeof body !== 'object') return fail('Invalid JSON');
  const { data, company, errors } = normalize(dept, body);
  if (errors.length) return fail('Please fix the highlighted fields', 422, { errors });
  if (user.company !== 'All' && company !== user.company) return fail(`You can only add ${user.company} records`, 403);
  const id = await createRecord(dept, data, user.id);
  return json({ id }, 201);
}
