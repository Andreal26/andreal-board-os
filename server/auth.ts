import 'server-only';
import { cookies } from 'next/headers';
import { redirect } from 'next/navigation';
import bcrypt from 'bcryptjs';
import { getSetting, one, query } from '@/db/client';
import { signSession, verifySession, SESSION_COOKIE } from '@/lib/session';
import type { DeptKey, Role, User } from '@/types';

export type { Role, User } from '@/types';


const USER_COLS = 'id, email, name, role, departments, company, active';

/** Session-signing secret: AUTH_SECRET if set, otherwise generated once and kept in the database. */
async function authSecret(): Promise<string> {
  if (process.env.AUTH_SECRET) return process.env.AUTH_SECRET;
  const { randomBytes } = await import('node:crypto');
  return (await getSetting('auth_secret', () => randomBytes(32).toString('base64url')))!;
}

export async function login(email: string, password: string): Promise<User | null> {
  const row = await one<User & { password_hash: string }>(
    `SELECT ${USER_COLS}, password_hash FROM users WHERE email = $1`,
    [email.trim().toLowerCase()],
  );
  if (!row || !row.active) return null;
  if (!bcrypt.compareSync(password, row.password_hash)) return null;
  await query('UPDATE users SET last_login_at = now() WHERE id = $1', [row.id]);
  const token = await signSession({ uid: row.id, role: row.role }, await authSecret());
  (await cookies()).set(SESSION_COOKIE, token, {
    httpOnly: true,
    // Hugging Face shows a Space inside an iframe on huggingface.co, so the cookie must be
    // SameSite=None (+Secure) in production. CSRF is blocked by the Origin check in middleware.
    sameSite: process.env.NODE_ENV === 'production' ? 'none' : 'lax',
    secure: process.env.NODE_ENV === 'production',
    path: '/',
    maxAge: 60 * 60 * 24 * 7,
  });
  const { password_hash: _ignored, ...user } = row;
  return user;
}

export async function logout() {
  (await cookies()).delete(SESSION_COOKIE);
}

export async function currentUser(): Promise<User | null> {
  const token = (await cookies()).get(SESSION_COOKIE)?.value;
  if (!token) return null;
  const payload = await verifySession(token, await authSecret());
  if (!payload) return null;
  const user = await one<User>(`SELECT ${USER_COLS} FROM users WHERE id = $1`, [payload.uid]);
  return user && user.active ? user : null;
}

/** For pages: redirect to /login when signed out. */
export async function requireUser(): Promise<User> {
  const user = await currentUser();
  if (!user) redirect('/login');
  return user;
}

export function hashPassword(pw: string) {
  return bcrypt.hashSync(pw, 10);
}

// ── Permissions ──────────────────────────────────────────────
export function canViewDept(user: User, dept: DeptKey) {
  if (user.role === 'admin' || user.role === 'ceo') return true;
  if (dept === 'hr') return user.departments.includes('hr'); // people data is restricted
  return true;
}

export function canEditDept(user: User, dept: DeptKey) {
  if (user.role === 'admin') return true;
  if (user.role === 'owner') return user.departments.includes(dept);
  return false;
}

export function canManageTargets(user: User) {
  return user.role === 'admin' || user.role === 'ceo';
}

export function canEditDeptNotes(user: User, dept: DeptKey) {
  return user.role === 'admin' || user.role === 'ceo' || canEditDept(user, dept);
}

export function isAdmin(user: User) {
  return user.role === 'admin';
}

/** Company a user is allowed to see. A user scoped to one company is locked to it. */
export function scopeCompany(user: User, requested?: string | null): 'All' | 'Andreal' | 'Anderson' {
  if (user.company !== 'All') return user.company;
  if (requested === 'Andreal' || requested === 'Anderson') return requested;
  return 'All';
}
