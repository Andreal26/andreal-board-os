import { upsertExternal } from '@/server/records';
import { fetchJson, syncMonths } from '@/server/integrations/shared';

/**
 * Google Ads → Marketing tab. One row per campaign per month.
 * Setup: a Google Ads developer token (API Center in a manager account — Basic/Explorer access is free),
 * an OAuth client (Google Cloud console) and a refresh token with the adwords scope.
 * GOOGLE_ADS_CUSTOMER_IDS = comma-separated ids without dashes. LOGIN_CUSTOMER_ID = manager account id if used.
 * Conversions are used as "leads" — make sure your lead form / call conversions are set as primary.
 */
async function accessToken() {
  const body = await fetchJson('https://oauth2.googleapis.com/token', {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: new URLSearchParams({
      client_id: process.env.GOOGLE_ADS_CLIENT_ID!,
      client_secret: process.env.GOOGLE_ADS_CLIENT_SECRET!,
      refresh_token: process.env.GOOGLE_ADS_REFRESH_TOKEN!,
      grant_type: 'refresh_token',
    }),
  });
  return body.access_token as string;
}

export async function syncGoogleAds(): Promise<number> {
  const v = process.env.GOOGLE_ADS_API_VERSION || 'v18';
  const token = await accessToken();
  const company = process.env.GOOGLE_ADS_COMPANY === 'Anderson' ? 'Anderson' : 'Andreal';
  const customers = (process.env.GOOGLE_ADS_CUSTOMER_IDS || '').split(',').map((s) => s.trim().replace(/-/g, '')).filter(Boolean);
  const headers: Record<string, string> = {
    Authorization: `Bearer ${token}`,
    'developer-token': process.env.GOOGLE_ADS_DEVELOPER_TOKEN!,
    'Content-Type': 'application/json',
  };
  if (process.env.GOOGLE_ADS_LOGIN_CUSTOMER_ID) headers['login-customer-id'] = process.env.GOOGLE_ADS_LOGIN_CUSTOMER_ID.replace(/-/g, '');
  let count = 0;
  for (const cid of customers) {
    for (const m of syncMonths()) {
      const gaql = `SELECT campaign.id, campaign.name, campaign.advertising_channel_type,
        metrics.cost_micros, metrics.impressions, metrics.clicks, metrics.conversions, metrics.interactions
        FROM campaign WHERE segments.date BETWEEN '${m.since}' AND '${m.until}'`;
      const chunks: any[] = await fetchJson(`https://googleads.googleapis.com/${v}/customers/${cid}/googleAds:searchStream`, {
        method: 'POST', headers, body: JSON.stringify({ query: gaql }),
      });
      const agg = new Map<string, any>();
      for (const chunk of chunks ?? []) {
        for (const r of chunk.results ?? []) {
          const id = r.campaign.id;
          const a = agg.get(id) ?? { name: r.campaign.name, type: r.campaign.advertisingChannelType, cost: 0, imp: 0, clicks: 0, conv: 0, inter: 0 };
          a.cost += Number(r.metrics.costMicros || 0) / 1e6;
          a.imp += Number(r.metrics.impressions || 0);
          a.clicks += Number(r.metrics.clicks || 0);
          a.conv += Number(r.metrics.conversions || 0);
          a.inter += Number(r.metrics.interactions || 0);
          agg.set(id, a);
        }
      }
      for (const [id, a] of agg) {
        if (!a.cost && !a.imp) continue;
        await upsertExternal('marketing', 'google_ads', `gads:${cid}:${id}:${m.month}`, {
          company,
          campaignName: `${a.name} (${m.month})`,
          channel: 'Google',
          assetName: a.type,
          startDate: m.since,
          endDate: m.until,
          actualSpend: Math.round(a.cost),
          impressions: a.imp,
          clicks: a.clicks,
          engagements: a.inter,
          leads: Math.round(a.conv),
        });
        count++;
      }
    }
  }
  return count;
}
