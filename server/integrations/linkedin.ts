import { upsertExternal } from '@/server/records';
import { fetchJson, syncMonths } from '@/server/integrations/shared';

/**
 * LinkedIn Ads → Marketing tab. One row per campaign per month.
 * Setup: a LinkedIn developer app with the Advertising API product (r_ads_reporting, r_ads),
 * a 3-legged OAuth access token, and LINKEDIN_AD_ACCOUNT_IDS (numeric sponsored account ids).
 * Note: LinkedIn access tokens expire after 60 days — refresh and update the env var.
 */
export async function syncLinkedIn(): Promise<number> {
  const version = process.env.LINKEDIN_API_VERSION || '202410';
  const token = process.env.LINKEDIN_ACCESS_TOKEN!;
  const company = process.env.LINKEDIN_COMPANY === 'Anderson' ? 'Anderson' : 'Andreal';
  const accounts = (process.env.LINKEDIN_AD_ACCOUNT_IDS || '').split(',').map((s) => s.trim()).filter(Boolean);
  const headers = { Authorization: `Bearer ${token}`, 'LinkedIn-Version': version, 'X-Restli-Protocol-Version': '2.0.0' };
  let count = 0;

  for (const acct of accounts) {
    const names = await campaignNames(acct, headers);
    for (const m of syncMonths()) {
      const [sy, sm, sd] = m.since.split('-').map(Number);
      const [ey, em, ed] = m.until.split('-').map(Number);
      const qs = [
        'q=analytics', 'pivot=CAMPAIGN', 'timeGranularity=ALL',
        `dateRange=(start:(year:${sy},month:${sm},day:${sd}),end:(year:${ey},month:${em},day:${ed}))`,
        `accounts=List(${encodeURIComponent(`urn:li:sponsoredAccount:${acct}`)})`,
        'fields=pivotValues,costInLocalCurrency,impressions,clicks,oneClickLeads,totalEngagements,landingPageClicks',
      ].join('&');
      const body = await fetchJson(`https://api.linkedin.com/rest/adAnalytics?${qs}`, { headers });
      for (const el of body.elements ?? []) {
        const urn: string = el.pivotValues?.[0] ?? '';
        const id = urn.split(':').pop() ?? urn;
        await upsertExternal('marketing', 'linkedin', `li:${id}:${m.month}`, {
          company,
          campaignName: `${names.get(id) ?? `LinkedIn campaign ${id}`} (${m.month})`,
          channel: 'LinkedIn',
          startDate: m.since,
          endDate: m.until,
          actualSpend: Math.round(Number(el.costInLocalCurrency) || 0),
          impressions: Number(el.impressions) || 0,
          clicks: Number(el.clicks) || 0,
          engagements: Number(el.totalEngagements) || undefined,
          lpVisits: Number(el.landingPageClicks) || undefined,
          leads: Number(el.oneClickLeads) || 0,
        });
        count++;
      }
    }
  }
  return count;
}

async function campaignNames(acct: string, headers: Record<string, string>) {
  const map = new Map<string, string>();
  try {
    const body = await fetchJson(`https://api.linkedin.com/rest/adAccounts/${acct}/adCampaigns?q=search&pageSize=500`, { headers });
    for (const c of body.elements ?? []) map.set(String(c.id), c.name);
  } catch {
    // names are cosmetic; analytics still sync with ids
  }
  return map;
}
