import bcrypt from 'bcryptjs';
import { withUser, json, fail } from '@/server/route-helpers';
import { hashPassword } from '@/server/auth';
import { one, query } from '@/db/client';
import { NextResponse } from 'next/server';

export async function POST(req: Request) {
  const user = await withUser(); if (user instanceof NextResponse) return user;
  const b = await req.json().catch(() => ({}));
  const row = await one<{ password_hash: string }>(`SELECT password_hash FROM users WHERE id = $1`, [user.id]);
  if (!row || !bcrypt.compareSync(String(b.current ?? ''), row.password_hash)) return fail('Current password is wrong', 401);
  if (String(b.next ?? '').length < 8) return fail('New password must be 8+ characters');
  await query(`UPDATE users SET password_hash = $2 WHERE id = $1`, [user.id, hashPassword(String(b.next))]);
  return json({ ok: true });
}
