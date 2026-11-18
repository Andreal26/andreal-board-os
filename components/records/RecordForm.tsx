'use client';
import { useMemo, useState } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { DEPARTMENTS, optionsFor, withComputed, type DeptKey, type Field, type RecordData } from '@/config/departments';
import { fmtField } from '@/lib/format';

export default function RecordForm({ dept, id, initial, canEdit, lockedCompany, meta }: {
  dept: DeptKey; id?: number; initial: RecordData; canEdit: boolean; lockedCompany?: string; meta?: { source: string; updated_at: string };
}) {
  const cfg = DEPARTMENTS[dept];
  const router = useRouter();
  const [data, setData] = useState<RecordData>(() => ({ ...(lockedCompany ? { company: lockedCompany } : {}), ...initial }));
  const [errors, setErrors] = useState<string[]>([]);
  const [busy, setBusy] = useState(false);
  const [saved, setSaved] = useState('');

  const computed = useMemo(() => withComputed(dept, data), [dept, data]);
  const fieldError = (f: Field) => errors.find((e) => e.startsWith(f.label));

  function set(k: string, v: string) {
    setSaved('');
    setData((d) => ({ ...d, [k]: v }));
  }

  async function save(e: React.FormEvent) {
    e.preventDefault();
    setBusy(true);
    setErrors([]);
    const payload: RecordData = {};
    for (const f of cfg.fields) if (!f.compute && data[f.key] !== undefined) payload[f.key] = data[f.key];
    const res = await fetch(id ? `/api/records/${dept}/${id}` : `/api/records/${dept}`, {
      method: id ? 'PUT' : 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(payload),
    });
    setBusy(false);
    const body = await res.json().catch(() => ({}));
    if (!res.ok) {
      setErrors(body.errors ?? [body.error || 'Save failed']);
      window.scrollTo({ top: 0, behavior: 'smooth' });
      return;
    }
    if (!id) {
      router.push(`/d/${dept}/${body.id}`);
    } else {
      setSaved('Saved');
    }
    router.refresh();
  }

  async function remove() {
    if (!id || !confirm('Delete this record? This cannot be undone.')) return;
    const res = await fetch(`/api/records/${dept}/${id}`, { method: 'DELETE' });
    if (res.ok) {
      router.push(`/d/${dept}`);
      router.refresh();
    }
  }

  return (
    <form onSubmit={save} className="space-y-5">
      {errors.length > 0 && (
        <div className="rounded-lg border border-coral-500/50 bg-coral-500/10 p-3 text-sm text-coral-300" role="alert">
          <b>Please fix:</b>
          <ul className="mt-1 list-disc pl-5">{errors.map((e) => <li key={e}>{e}</li>)}</ul>
        </div>
      )}
      {cfg.groups.map((g) => (
        <fieldset key={g} className="card card-pad">
          <legend className="px-1 text-xs font-medium uppercase tracking-wider text-teal-400">{g}</legend>
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
            {cfg.fields.filter((f) => f.group === g).map((f) => (
              <div key={f.key} className={f.type === 'textarea' ? 'sm:col-span-2 lg:col-span-3' : ''}>
                <label className="label" htmlFor={f.key}>
                  {f.label}{f.required && <span className="text-coral-400"> *</span>}
                  {f.compute && <span className="ml-1 text-[10px] uppercase text-teal-500">auto</span>}
                </label>
                <Input f={f} value={f.compute ? computed[f.key] : data[f.key]} onChange={(v) => set(f.key, v)}
                  disabled={!canEdit || !!f.compute || (f.key === 'company' && !!lockedCompany)} invalid={!!fieldError(f)} />
                {f.help && <p className="mt-1 text-[11px] text-ink-500">{f.help}</p>}
              </div>
            ))}
          </div>
        </fieldset>
      ))}
      <div className="no-print sticky bottom-0 flex flex-wrap items-center gap-3 border-t border-ink-700 bg-ink-950/95 py-3">
        {canEdit && <button className="btn-primary" disabled={busy}>{busy ? 'Saving…' : id ? 'Save changes' : 'Create record'}</button>}
        <Link className="btn-ghost" href={`/d/${dept}`}>Back to list</Link>
        {saved && <span className="text-sm text-rag-green">{saved}</span>}
        {meta && <span className="text-xs text-gray-500">Source: {meta.source} · updated {new Date(meta.updated_at).toLocaleString('en-GB')}</span>}
        {canEdit && id && <button type="button" className="btn-danger ml-auto" onClick={remove}>Delete</button>}
      </div>
    </form>
  );
}

function Input({ f, value, onChange, disabled, invalid }: { f: Field; value: any; onChange: (v: string) => void; disabled: boolean; invalid: boolean }) {
  const cls = `input ${invalid ? 'border-coral-500' : ''}`;
  if (f.compute) {
    return <div className="input bg-ink-800 text-teal-200" aria-readonly>{fmtField(value, f.type) || '—'}</div>;
  }
  const v = value ?? '';
  switch (f.type) {
    case 'textarea':
      return <textarea id={f.key} rows={3} className={cls} disabled={disabled} value={v} onChange={(e) => onChange(e.target.value)} />;
    case 'select':
      return (
        <select id={f.key} className={cls} disabled={disabled} value={v} onChange={(e) => onChange(e.target.value)}>
          <option value="">—</option>
          {(optionsFor(f) ?? []).map((o) => <option key={o}>{o}</option>)}
        </select>
      );
    case 'date':
      return <input id={f.key} type="date" className={cls} disabled={disabled} value={String(v).slice(0, 10)} onChange={(e) => onChange(e.target.value)} />;
    case 'number': case 'currency': case 'percent': case 'score':
      return (
        <div className="relative">
          {f.type === 'currency' && <span className="pointer-events-none absolute left-3 top-2 text-sm text-ink-500">₹</span>}
          <input id={f.key} type="number" step="any" min={f.type === 'score' ? 0 : undefined} max={f.max} className={`${cls} ${f.type === 'currency' ? 'pl-7' : ''}`}
            disabled={disabled} value={v} onChange={(e) => onChange(e.target.value)} placeholder={f.type === 'percent' ? '0–100' : f.type === 'score' ? `0–${f.max}` : ''} />
        </div>
      );
    default:
      return <input id={f.key} className={cls} disabled={disabled} value={v} onChange={(e) => onChange(e.target.value)} />;
  }
}
