import { NextResponse } from 'next/server';
import { currentUser } from '@/server/auth';

/** Is the session cookie reaching the server? (Phones block cookies inside the Hugging Face frame.) */
export async function GET() {
  const user = await currentUser();
  return user ? NextResponse.json({ ok: true }) : NextResponse.json({ ok: false }, { status: 401 });
}
