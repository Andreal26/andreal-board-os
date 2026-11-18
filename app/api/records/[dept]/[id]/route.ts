import { withUser, deptOr404, json, fail } from '@/server/route-helpers';
import { canEditDept, canViewDept } from '@/server/auth';
import { deleteRecord, getRecord, updateRecord } from '@/server/records';
import { normalize } from '@/lib/validation';
import { NextResponse } from 'next/server';

type Ctx = { params: Promise<{ dept: string; id: string }> };

async function load(ctx: Ctx) {
  const user = await withUser(); if (user instanceof NextResponse) return user;
  const p = await ctx.params;
  const dept = deptOr404(p.dept); if (dept instanceof NextResponse) return dept;
  const rec = await getRecord(dept, Number(p.id));
  if (!rec) return fail('Record not found', 404);
  if (!canViewDept(user, dept) || (user.company !== 'All' && rec.company !== user.company)) return fail('Not allowed', 403);
  return { user, dept, rec };
}

export async function GET(_req: Request, ctx: Ctx) {
  const r = await load(ctx); if (r instanceof NextResponse) return r;
  return json({ record: r.rec });
}

export async function PUT(req: Request, ctx: Ctx) {
  const r = await load(ctx); if (r instanceof NextResponse) return r;
  if (!canEditDept(r.user, r.dept)) return fail('You can view but not edit this department', 403);
  const body = await req.json().catch(() => null);
  if (!body) return fail('Invalid JSON');
  const { data, errors } = normalize(r.dept, body);
  if (errors.length) return fail('Please fix the highlighted fields', 422, { errors });
  await updateRecord(r.dept, r.rec.id, data, r.user.id);
  return json({ ok: true });
}

export async function DELETE(_req: Request, ctx: Ctx) {
  const r = await load(ctx); if (r instanceof NextResponse) return r;
  if (!canEditDept(r.user, r.dept)) return fail('Not allowed', 403);
  await deleteRecord(r.dept, r.rec.id, r.user.id);
  return json({ ok: true });
}
