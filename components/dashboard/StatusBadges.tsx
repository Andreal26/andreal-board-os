import type { Rag as RagT, Status } from '@/types';

const RAG: Record<RagT, { cls: string; icon: string }> = {
  Green: { cls: 'border-rag-green/40 bg-rag-green/10 text-rag-green', icon: '●' },
  Amber: { cls: 'border-rag-amber/40 bg-rag-amber/10 text-rag-amber', icon: '▲' },
  Red: { cls: 'border-rag-red/40 bg-rag-red/10 text-rag-red', icon: '■' },
  'No data': { cls: 'border-ink-600 bg-ink-800 text-gray-400', icon: '○' },
};

export function RagBadge({ rag }: { rag: RagT }) {
  const r = RAG[rag];
  return (
    <span className={`inline-flex items-center gap-1.5 rounded-full border px-2 py-0.5 text-xs font-medium ${r.cls}`}>
      <span aria-hidden className="text-[9px]">{r.icon}</span>{rag}
    </span>
  );
}

const STATUS: Record<Status, { label: string; rag: RagT }> = {
  good: { label: 'On target', rag: 'Green' },
  watch: { label: 'Watch', rag: 'Amber' },
  bad: { label: 'Off target', rag: 'Red' },
  none: { label: 'No target', rag: 'No data' },
};

export function StatusBadge({ status, label }: { status: Status; label?: string }) {
  const s = STATUS[status];
  const r = RAG[s.rag];
  return (
    <span className={`inline-flex items-center gap-1 rounded-full border px-2 py-0.5 text-[11px] font-medium ${r.cls}`}>
      <span aria-hidden className="text-[8px]">{r.icon}</span>{label ?? s.label}
    </span>
  );
}

export const statusText = (s: Status) => (s === 'good' ? 'text-rag-green' : s === 'watch' ? 'text-rag-amber' : s === 'bad' ? 'text-rag-red' : 'text-white');
