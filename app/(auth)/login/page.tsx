'use client';
import { useEffect, useState, Suspense } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';

function LoginForm() {
  const router = useRouter();
  const sp = useSearchParams();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);
  const [framed, setFramed] = useState(false);
  const [blocked, setBlocked] = useState(false);
  useEffect(() => {
    try { setFramed(window.self !== window.top); } catch { setFramed(true); }
  }, []);
  const ownTab = typeof window !== 'undefined' ? `${window.location.origin}/login` : '/login';

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setError('');
    if (!email || !password) return setError('Enter your email and password.');
    setBusy(true);
    const res = await fetch('/api/auth/login', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ email, password }) });
    setBusy(false);
    if (!res.ok) return setError((await res.json().catch(() => ({}))).error || 'Sign-in failed');
    // Inside the Hugging Face page, phones (Safari, some Chrome settings) drop the sign-in cookie.
    const check = await fetch('/api/auth/check', { cache: 'no-store' }).catch(() => null);
    if (!check?.ok) return setBlocked(true);
    router.replace(sp.get('next') || '/');
    router.refresh();
  }

  return (
    <form onSubmit={submit} className="card card-pad w-full max-w-sm space-y-4">
      <div>
        <div className="kicker">Andreal · Anderson</div>
        <h1 className="h-display mt-1 text-3xl">BOARD <span className="text-coral-500">OS</span></h1>
        <p className="mt-1 text-sm text-gray-400">CEO / Controller / Board control system</p>
      </div>
      <div>
        <label className="label" htmlFor="email">Email</label>
        <input id="email" className="input" type="email" autoComplete="username" value={email} onChange={(e) => setEmail(e.target.value)} />
      </div>
      <div>
        <label className="label" htmlFor="password">Password</label>
        <input id="password" className="input" type="password" autoComplete="current-password" value={password} onChange={(e) => setPassword(e.target.value)} />
      </div>
      {error && <p className="text-sm text-coral-400" role="alert">{error}</p>}
      {(framed || blocked) && (
        <div className={`rounded-lg border p-3 text-sm ${blocked ? 'border-coral-500/60 bg-coral-500/10 text-coral-200' : 'border-ink-600 text-gray-300'}`}>
          {blocked
            ? 'Your browser blocked sign-in inside this Hugging Face page. Open Board OS in its own tab to continue.'
            : 'On a phone, sign-in works best with Board OS open in its own tab.'}
          <a href={ownTab} target="_blank" rel="noopener noreferrer" className="btn-primary mt-2 w-full">Open Board OS in its own tab ↗</a>
        </div>
      )}
      <button className="btn-primary w-full" disabled={busy}>{busy ? 'Signing in…' : 'Sign in'}</button>
    </form>
  );
}

export default function LoginPage() {
  return (
    <main className="flex min-h-screen items-center justify-center bg-[radial-gradient(ellipse_at_top,_#12302d_0%,_#0b0d10_60%)] p-6">
      <Suspense><LoginForm /></Suspense>
    </main>
  );
}
