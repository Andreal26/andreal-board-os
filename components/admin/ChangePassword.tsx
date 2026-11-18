'use client';
import { useState } from 'react';

export default function ChangePassword() {
  const [current, setCurrent] = useState('');
  const [next, setNext] = useState('');
  const [msg, setMsg] = useState('');
  async function save(e: React.FormEvent) {
    e.preventDefault();
    if (next.length < 8) return setMsg('New password must be 8+ characters.');
    const res = await fetch('/api/me/password', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ current, next }) });
    const b = await res.json().catch(() => ({}));
    setMsg(res.ok ? 'Password changed.' : b.error || 'Failed');
    if (res.ok) { setCurrent(''); setNext(''); }
  }
  return (
    <form onSubmit={save} className="card card-pad flex flex-wrap items-end gap-3">
      <h2 className="w-full text-sm font-medium text-white">Change my password</h2>
      <div><label className="label" htmlFor="pw-cur">Current password</label><input id="pw-cur" type="password" className="input" value={current} onChange={(e) => setCurrent(e.target.value)} /></div>
      <div><label className="label" htmlFor="pw-new">New password</label><input id="pw-new" type="password" className="input" value={next} onChange={(e) => setNext(e.target.value)} /></div>
      <button className="btn-primary">Update</button>
      {msg && <span className="text-sm text-gray-300">{msg}</span>}
    </form>
  );
}
