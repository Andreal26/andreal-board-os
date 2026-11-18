import { NextResponse, type NextRequest } from 'next/server';
import { SESSION_COOKIE } from '@/lib/session';

const PUBLIC = ['/login', '/api/auth/login', '/api/cron/', '/api/health'];

export async function middleware(req: NextRequest) {
  const { pathname } = req.nextUrl;
  if (PUBLIC.some((p) => pathname.startsWith(p))) return NextResponse.next();

  // CSRF guard: state-changing API calls must come from this app's own origin.
  if (pathname.startsWith('/api/') && !['GET', 'HEAD', 'OPTIONS'].includes(req.method)) {
    const origin = req.headers.get('origin');
    if (origin) {
      const allowed = new Set([req.headers.get('host'), req.headers.get('x-forwarded-host'), req.nextUrl.host].filter(Boolean));
      try { if (process.env.APP_URL) allowed.add(new URL(process.env.APP_URL).host); } catch { /* ignore bad APP_URL */ }
      let ok = false;
      try { ok = allowed.has(new URL(origin).host); } catch { ok = false; }
      if (!ok) return NextResponse.json({ error: 'Cross-site request blocked' }, { status: 403 });
    }
  }

  // Fast gate only: the token's signature and the user are verified server-side on every page and API call
  // (server/auth.ts → currentUser), where the signing secret lives.
  const token = req.cookies.get(SESSION_COOKIE)?.value;
  if (token && token.split('.').length === 3) return NextResponse.next();

  if (pathname.startsWith('/api/')) {
    return NextResponse.json({ error: 'Not signed in' }, { status: 401 });
  }
  const url = req.nextUrl.clone();
  url.pathname = '/login';
  url.searchParams.set('next', pathname);
  return NextResponse.redirect(url);
}

export const config = {
  matcher: ['/((?!_next/static|_next/image|favicon.ico|.*\\.(?:png|svg|ico|jpg)$).*)'],
};
