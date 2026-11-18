'use client';
import { useState } from 'react';
import { useRouter } from 'next/navigation';

export default function RunJobButton({ job, label }: { job: string; label: string }) {
  const router = useRouter();
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState('');
  async function run() {
    setBusy(true);
    setMsg('');
    const res = await fetch(`/api/cron/${job}`, { method: 'POST' });
    const b = await res.json().catch(() => ({}));
    setBusy(false);
    if (!res.ok) return setMsg(b.error || 'Failed');
    if (job === 'alerts') setMsg(`${b.count} alerts · ${(b.results ?? []).join(' · ') || 'no email sent'}`);
    else if (job === 'sync') setMsg((b.results ?? []).map((r: any) => `${r.key}: ${r.status}${r.rows ? ` (${r.rows})` : ''}`).join(' · '));
    else if (job === 'weekly') setMsg(b.info ?? 'done');
    else setMsg('Done');
    router.refresh();
  }
  return (
    <div className="flex flex-col items-start gap-1">
      <button className="btn-ghost" onClick={run} disabled={busy}>{busy ? 'Running…' : label}</button>
      {msg && <span className="max-w-md text-xs text-gray-400">{msg}</span>}
    </div>
  );
}
