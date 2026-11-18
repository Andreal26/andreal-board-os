import { login } from '@/server/auth';
import { json, fail } from '@/server/route-helpers';
import { one } from '@/db/client';

export async function POST(req: Request) {
  const body = await req.json().catch(() => ({}));
  if (!body.email || !body.password) return fail('Email and password are required');
  const user = await login(String(body.email), String(body.password));
  if (!user) {
    const row = await one<{ n: number }>('SELECT count(*)::int AS n FROM users');
    if (row?.n === 0) return fail('No admin account yet — add the ADMIN_PASSWORD secret in the Space settings, then sign in.', 401);
    return fail('Wrong email or password', 401);
  }
  return json({ ok: true, user: { name: user.name, role: user.role } });
}
