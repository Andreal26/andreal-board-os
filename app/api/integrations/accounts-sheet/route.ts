import { NextResponse } from 'next/server';
import { withUser, json, fail } from '@/server/route-helpers';
import { isAdmin } from '@/server/auth';
import { audit } from '@/db/client';
import { disconnectAccountsSheet, saveAccountsSheetUrl, validAccountsUrl } from '@/server/integrations/accounts-sheet';
import { INTEGRATIONS, runIntegration } from '@/server/integrations';

/** Save the Apps Script link (admin) and run a first sync straight away. */
export async function POST(req: Request) {
  const user = await withUser(); if (user instanceof NextResponse) return user;
  if (!isAdmin(user)) return fail('Admins only', 403);
  const { url } = (await req.json().catch(() => ({}))) as { url?: string };
  const link = String(url ?? '').trim();
  if (!validAccountsUrl(link)) return fail('Paste the full link from the Apps Script log: https://script.google.com/…/exec?token=…');
  await saveAccountsSheetUrl(link);
  await audit(user.id, 'accounts_sheet_connect', 'cashflow', null);
  const result = await runIntegration(INTEGRATIONS.find((i) => i.key === 'accounts_sheet')!);
  return json({ ok: result.status === 'ok', result });
}

export async function DELETE() {
  const user = await withUser(); if (user instanceof NextResponse) return user;
  if (!isAdmin(user)) return fail('Admins only', 403);
  await disconnectAccountsSheet();
  await audit(user.id, 'accounts_sheet_disconnect', 'cashflow', null);
  return json({ ok: true });
}
