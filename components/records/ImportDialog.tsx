'use client';
import { useState } from 'react';
import { useRouter } from 'next/navigation';
import type { DeptKey } from '@/config/departments';

interface Result { total: number; imported: number; valid: number; problems: { row: number; errors: string[] }[]; dryRun: boolean }

export default function ImportDialog({ dept, onClose }: { dept: DeptKey; onClose: () => void }) {
  const router = useRouter();
  const [file, setFile] = useState<File | null>(null);
  const [result, setResult] = useState<Result | null>(null);
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);

  async function send(dryRun: boolean) {
    setError('');
    if (!file) return setError('Choose a CSV file first.');
    setBusy(true);
    const fd = new FormData();
    fd.append('file', file);
    const res = await fetch(`/api/import/${dept}${dryRun ? '?dryRun=1' : ''}`, { method: 'POST', body: fd });
    setBusy(false);
    const body = await res.json().catch(() => ({}));
    if (!res.ok) return setError(body.error || 'Import failed');
    setResult(body);
    if (!dryRun) router.refresh();
  }

  return (
    <div className="mt-4 rounded-xl border border-teal-600/40 bg-ink-900 p-5">
      <div className="flex items-center justify-between">
        <h3 className="text-sm font-medium text-white">Import CSV</h3>
        <button className="text-xs text-gray-400 hover:text-white" onClick={onClose}>Close</button>
      </div>
      <p className="mt-1 text-xs text-gray-400">Use the CSV template headers (or the old workbook column names). Dates can be dd/mm/yyyy. Dropdown values must match the lists. Check first, then import — rows with errors are skipped.</p>
      <div className="mt-3 flex flex-wrap items-center gap-2">
        <input aria-label="CSV file" type="file" accept=".csv,text/csv" className="text-sm text-gray-300" onChange={(e) => { setFile(e.target.files?.[0] ?? null); setResult(null); }} />
        <button className="btn-ghost" disabled={busy} onClick={() => send(true)}>Check file</button>
        <button className="btn-primary" disabled={busy || !result || result.dryRun === false || !result.valid} onClick={() => send(false)}>Import {result?.dryRun ? result.valid : ''} rows</button>
      </div>
      {error && <p className="mt-2 text-sm text-coral-400">{error}</p>}
      {result && (
        <div className="mt-3 text-sm">
          <p className="text-gray-200">
            {result.dryRun ? `${result.valid} of ${result.total} rows are valid.` : `Imported ${result.imported} of ${result.total} rows.`}
          </p>
          {!!result.problems.length && (
            <ul className="mt-2 max-h-48 space-y-1 overflow-y-auto text-xs text-coral-300">
              {result.problems.map((p) => <li key={p.row}>Row {p.row}: {p.errors.join('; ')}</li>)}
            </ul>
          )}
        </div>
      )}
    </div>
  );
}
