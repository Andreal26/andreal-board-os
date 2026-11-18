'use client';
import { useState } from 'react';
import { useRouter } from 'next/navigation';

/** Paste-the-link form for the Accounts sheet Apps Script, plus Disconnect. */
export default function AccountsSheetConnect({ connected, fromDb }: { connected: boolean; fromDb: boolean }) {
  const router = useRouter();
  const [open, setOpen] = useState(!connected);
  const [url, setUrl] = useState('');
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState<[string, string] | null>(null);

  async function save(e: React.FormEvent) {
    e.preventDefault();
    setBusy(true); setMsg(null);
    const res = await fetch('/api/integrations/accounts-sheet', { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ url }) });
    const body = await res.json().catch(() => ({}));
    setBusy(false);
    if (!res.ok) return setMsg(['text-rag-red', body.error || 'Could not save the link']);
    if (body.ok) { setMsg(['text-rag-green', `Connected — ${body.result.rows} invoice lines synced.`]); setUrl(''); setOpen(false); }
    else setMsg(['text-rag-amber', `Link saved, but the first sync failed: ${body.result?.message ?? 'unknown error'}`]);
    router.refresh();
  }

  async function disconnect() {
    setBusy(true);
    await fetch('/api/integrations/accounts-sheet', { method: 'DELETE' });
    setBusy(false); setOpen(true);
    router.refresh();
  }

  return (
    <div className="space-y-2">
      {connected && !open && (
        <div className="flex flex-wrap items-center gap-2">
          <button className="btn-ghost px-3 py-1 text-xs" onClick={() => setOpen(true)} disabled={busy}>Change link</button>
          {fromDb && <button className="btn-ghost px-3 py-1 text-xs" onClick={disconnect} disabled={busy}>Disconnect</button>}
        </div>
      )}
      {open && (
        <form onSubmit={save} className="flex flex-wrap items-center gap-2">
          <input className="input min-w-[18rem] flex-1 text-xs" type="url" required placeholder="https://script.google.com/macros/s/…/exec?token=…"
            value={url} onChange={(e) => setUrl(e.target.value)} autoComplete="off" />
          <button className="btn-primary px-3 py-1 text-xs" disabled={busy}>{busy ? 'Connecting…' : 'Connect'}</button>
        </form>
      )}
      {msg && <p className={`text-xs ${msg[0]}`}>{msg[1]}</p>}
    </div>
  );
}
