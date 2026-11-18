import { NextResponse } from 'next/server';
import { currentUser, type User } from '@/server/auth';
import { isDeptKey, type DeptKey } from '@/config/departments';

export const json = (data: unknown, status = 200) => NextResponse.json(data, { status });
export const fail = (message: string, status = 400, extra?: Record<string, unknown>) => NextResponse.json({ error: message, ...extra }, { status });

export async function withUser(): Promise<User | NextResponse> {
  const u = await currentUser();
  return u ?? fail('Not signed in', 401);
}

export function deptOr404(v: string): DeptKey | NextResponse {
  return isDeptKey(v) ? v : fail('Unknown department', 404);
}
