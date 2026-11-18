'use client';
import { useState, Suspense } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';

function LoginForm() {
  const router = useRouter();
  const sp = useSearchParams();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setError('');
    if (!email || !password) return setError('Enter your email and password.');
    setBusy(true);
    const res = await fetch('/api/auth/login', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ email, password }) });
    setBusy(false);
    if (!res.ok) return setError((await res.json().catch(() => ({}))).error || 'Sign-in failed');
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
