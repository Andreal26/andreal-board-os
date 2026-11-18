'use client';
import { useState } from 'react';
import { useRouter } from 'next/navigation';
import type { DeptKey } from '@/config/departments';

interface Note { status: string | null; major_risk: string | null; decision_needed: string | null; owner: string | null; deadline: string | null; notes: string | null; updated_at: string | null }

const FIELDS: { k: keyof Note; label: string; area?: boolean }[] = [
  { k: 'status', label: 'Current status' },
  { k: 'major_risk', label: 'Major risk', area: true },
  { k: 'decision_needed', label: 'Decision needed from CEO / board', area: true },
  { k: 'owner', label: 'Owner' },
  { k: 'deadline', label: 'Deadline' },
  { k: 'notes', label: 'Implementation notes', area: true },
];

export default function DeptNotesEditor({ dept, name, note, canEdit }: { dept: DeptKey; name: string; note: Note | null; canEdit: boolean }) {
  const router = useRouter();
  const [v, setV] = useState<Partial<Note>>(note ?? {});
  const [msg, setMsg] = useState('');
  const [busy, setBusy] = useState(false);

  async function save() {
    setBusy(true);
    setMsg('');
    const res = await fetch(`/api/dept-notes/${dept}`, { method: 'PUT', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(v) });
    setBusy(false);
    setMsg(res.ok ? 'Saved' : (await res.json().catch(() => ({}))).error || 'Save failed');
    if (res.ok) router.refresh();
  }

  return (
    <div className="card card-pad space-y-3">
      <div className="flex items-center justify-between">
        <h3 className="text-sm font-medium text-white">{name}</h3>
        {note?.updated_at && <span className="text-[11px] text-ink-500">updated {new Date(note.updated_at).toLocaleDateString('en-GB')}</span>}
      </div>
      {FIELDS.map((f) => (
        <div key={f.k}>
          <label className="label" htmlFor={`${dept}-${f.k}`}>{f.label}</label>
          {f.area ? (
            <textarea id={`${dept}-${f.k}`} rows={2} className="input" disabled={!canEdit} value={v[f.k] ?? ''} onChange={(e) => setV({ ...v, [f.k]: e.target.value })} />
          ) : (
            <input id={`${dept}-${f.k}`} className="input" disabled={!canEdit} value={v[f.k] ?? ''} onChange={(e) => setV({ ...v, [f.k]: e.target.value })} />
          )}
        </div>
      ))}
      {canEdit && (
        <div className="flex items-center gap-3">
          <button className="btn-primary" onClick={save} disabled={busy}>{busy ? 'Saving…' : 'Save'}</button>
          {msg && <span className="text-xs text-gray-400">{msg}</span>}
        </div>
      )}
    </div>
  );
}
