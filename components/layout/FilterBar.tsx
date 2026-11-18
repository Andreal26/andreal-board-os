'use client';
import { usePathname, useRouter, useSearchParams } from 'next/navigation';
import { PERIODS } from '@/lib/periods';

export default function FilterBar({ company, period, lockCompany, showPeriod = true }: { company: string; period: string; lockCompany?: boolean; showPeriod?: boolean }) {
  const router = useRouter();
  const path = usePathname();
  const sp = useSearchParams();
  const set = (k: string, v: string) => {
    const q = new URLSearchParams(sp.toString());
    q.set(k, v);
    router.push(`${path}?${q.toString()}`);
  };
  return (
    <div className="no-print flex flex-wrap items-center gap-2">
      <div className="flex overflow-hidden rounded-lg border border-ink-600" role="group" aria-label="Company">
        {['All', 'Andreal', 'Anderson'].map((c) => (
          <button
            key={c}
            disabled={lockCompany && c !== company}
            onClick={() => set('company', c)}
            className={`px-3 py-1.5 text-sm transition ${company === c ? 'bg-teal-500 text-ink-950' : 'text-gray-300 hover:bg-ink-800 disabled:opacity-40'}`}
          >
            {c}
          </button>
        ))}
      </div>
      {showPeriod && (
        <select aria-label="Period" className="input w-auto py-1.5" value={period} onChange={(e) => set('period', e.target.value)}>
          {PERIODS.map((p) => <option key={p.key} value={p.key}>{p.label}</option>)}
        </select>
      )}
    </div>
  );
}
