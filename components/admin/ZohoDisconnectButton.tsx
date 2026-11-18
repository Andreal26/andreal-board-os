'use client';
import { useState } from 'react';
import { useRouter } from 'next/navigation';

export default function ZohoDisconnectButton({ product = 'crm' }: { product?: 'crm' | 'projects' }) {
  const router = useRouter();
  const [busy, setBusy] = useState(false);
  async function go() {
    if (!confirm(`Disconnect Zoho ${product === 'crm' ? 'CRM' : 'Projects'}? The daily sync stops until you connect again. Synced rows stay.`)) return;
    setBusy(true);
    await fetch(`/api/integrations/zoho/disconnect?product=${product}`, { method: 'POST' });
    setBusy(false);
    router.refresh();
  }
  return <button className="btn-ghost px-3 py-1 text-xs" onClick={go} disabled={busy}>Disconnect</button>;
}
