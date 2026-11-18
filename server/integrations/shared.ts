/** Shared helpers for integrations. */
/** Month windows to sync: previous month (to settle late numbers) and the current month. */
export function syncMonths(): { month: string; since: string; until: string }[] {
  const now = new Date();
  const res = [];
  for (const delta of [-1, 0]) {
    const s = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth() + delta, 1));
    const e = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth() + delta + 1, 0));
    const until = e > now ? now : e;
    res.push({ month: s.toISOString().slice(0, 7), since: s.toISOString().slice(0, 10), until: until.toISOString().slice(0, 10) });
  }
  return res;
}

export async function fetchJson(url: string, init?: RequestInit) {
  const res = await fetch(url, { ...init, cache: 'no-store' });
  const text = await res.text();
  let body: any;
  try { body = text ? JSON.parse(text) : {}; } catch { body = { raw: text }; }
  if (!res.ok) throw new Error(`${res.status} ${res.statusText}: ${text.slice(0, 300)}`);
  return body;
}
