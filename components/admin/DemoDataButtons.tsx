'use client';
import { useState } from 'react';
import { useRouter } from 'next/navigation';

export default function DemoDataButtons({ demoRows }: { demoRows: number }) {
  const router = useRouter();
  const [msg, setMsg] = useState('');
  const [busy, setBusy] = useState(false);
  async function act(action: string) {
    if (action === 'clear' && !confirm('Remove all demo rows? Real data is not touched.')) return;
    setBusy(true);
    const res = await fetch('/api/admin/demo', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ action }) });
    const b = await res.json().catch(() => ({}));
    setBusy(false);
    setMsg(b.message || b.error || '');
    router.refresh();
  }
  return (
    <div className="flex flex-wrap items-center gap-3">
      <button className="btn-ghost" disabled={busy || demoRows > 0} onClick={() => act('load')}>Load demo data</button>
      <button className="btn-danger" disabled={busy || demoRows === 0} onClick={() => act('clear')}>Clear demo data ({demoRows})</button>
      <button className="btn-ghost" disabled={busy} onClick={() => act('rnd')}>Reload workbook R&amp;D</button>
      {msg && <span className="text-xs text-gray-400">{msg}</span>}
    </div>
  );
}
