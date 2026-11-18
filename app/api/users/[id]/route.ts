import { withUser, json, fail } from '@/server/route-helpers';
import { hashPassword, isAdmin } from '@/server/auth';
import { query, audit } from '@/db/client';
import { DEPT_KEYS } from '@/config/departments';
import { NextResponse } from 'next/server';

type Ctx = { params: Promise<{ id: string }> };

export async function PUT(req: Request, ctx: Ctx) {
  const user = await withUser(); if (user instanceof NextResponse) return user;
  if (!isAdmin(user)) return fail('Admins only', 403);
  const id = Number((await ctx.params).id);
  const b = await req.json().catch(() => ({}));
  if (id === user.id && (b.role && b.role !== 'admin' || b.active === false)) return fail('You cannot demote or deactivate yourself');
  if (b.role && !['admin', 'ceo', 'owner', 'viewer'].includes(b.role)) return fail('Invalid role');
  const depts = Array.isArray(b.departments) ? b.departments.filter((d: string) => (DEPT_KEYS as string[]).includes(d)) : null;
  await query(
    `UPDATE users SET
       name = COALESCE($2, name), role = COALESCE($3, role),
       departments = COALESCE($4::jsonb, departments), company = COALESCE($5, company),
       active = COALESCE($6, active)
     WHERE id = $1`,
    [id, b.name ?? null, b.role ?? null, depts ? JSON.stringify(depts) : null,
     ['All', 'Andreal', 'Anderson'].includes(b.company) ? b.company : null, typeof b.active === 'boolean' ? b.active : null],
  );
  if (b.password) {
    if (String(b.password).length < 8) return fail('Password must be 8+ characters');
    await query(`UPDATE users SET password_hash = $2 WHERE id = $1`, [id, hashPassword(String(b.password))]);
  }
  await audit(user.id, 'user_update', null, null, { id });
  return json({ ok: true });
}
