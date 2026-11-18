import { withUser, json, fail } from '@/server/route-helpers';
import { hashPassword, isAdmin } from '@/server/auth';
import { query, audit } from '@/db/client';
import { DEPT_KEYS } from '@/config/departments';
import { NextResponse } from 'next/server';

const ROLES = ['admin', 'ceo', 'owner', 'viewer'];

export async function GET() {
  const user = await withUser(); if (user instanceof NextResponse) return user;
  if (!isAdmin(user)) return fail('Admins only', 403);
  return json({ users: await query(`SELECT id, email, name, role, departments, company, active, last_login_at FROM users ORDER BY id`) });
}

export async function POST(req: Request) {
  const user = await withUser(); if (user instanceof NextResponse) return user;
  if (!isAdmin(user)) return fail('Admins only', 403);
  const b = await req.json().catch(() => ({}));
  const email = String(b.email ?? '').trim().toLowerCase();
  if (!/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(email)) return fail('Valid email required');
  if (!b.name || String(b.password ?? '').length < 8) return fail('Name and a password of 8+ characters are required');
  if (!ROLES.includes(b.role)) return fail('Invalid role');
  const depts = (Array.isArray(b.departments) ? b.departments : []).filter((d: string) => (DEPT_KEYS as string[]).includes(d));
  const company = ['All', 'Andreal', 'Anderson'].includes(b.company) ? b.company : 'All';
  try {
    const [row] = await query<{ id: number }>(
      `INSERT INTO users (email, name, password_hash, role, departments, company) VALUES ($1,$2,$3,$4,$5::jsonb,$6) RETURNING id`,
      [email, String(b.name), hashPassword(String(b.password)), b.role, JSON.stringify(depts), company],
    );
    await audit(user.id, 'user_create', null, null, { email, role: b.role });
    return json({ id: row.id }, 201);
  } catch {
    return fail('A user with that email already exists', 409);
  }
}
