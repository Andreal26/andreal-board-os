import { logout } from '@/server/auth';
import { NextResponse } from 'next/server';

export async function POST(req: Request) {
  await logout();
  return NextResponse.redirect(new URL('/login', req.url), 303);
}
