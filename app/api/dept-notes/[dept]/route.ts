import { withUser, deptOr404, json, fail } from '@/server/route-helpers';
import { canEditDeptNotes } from '@/server/auth';
import { query, audit } from '@/db/client';
import { NextResponse } from 'next/server';

type Ctx = { params: Promise<{ dept: string }> };
const KEYS = ['status', 'major_risk', 'decision_needed', 'owner', 'deadline', 'notes'] as const;

export async function PUT(req: Request, ctx: Ctx) {
  const user = await withUser(); if (user instanceof NextResponse) return user;
  const dept = deptOr404((await ctx.params).dept); if (dept instanceof NextResponse) return dept;
  if (!canEditDeptNotes(user, dept)) return fail('Not allowed', 403);
  const b = await req.json().catch(() => ({}));
  const v = KEYS.map((k) => (b[k] === undefined || b[k] === null ? null : String(b[k]).slice(0, 2000)));
  await query(
    `INSERT INTO dept_notes (dept, status, major_risk, decision_needed, owner, deadline, notes, updated_by, updated_at)
     VALUES ($1,$2,$3,$4,$5,$6,$7,$8, now())
     ON CONFLICT (dept) DO UPDATE SET status=$2, major_risk=$3, decision_needed=$4, owner=$5, deadline=$6, notes=$7, updated_by=$8, updated_at=now()`,
    [dept, ...v, user.id],
  );
  await audit(user.id, 'dept_notes', dept, null);
  return json({ ok: true });
}
