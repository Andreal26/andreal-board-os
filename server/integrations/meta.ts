import { upsertExternal } from '@/server/records';
import { fetchJson, syncMonths } from '@/server/integrations/shared';

/**
 * Meta (Facebook / Instagram) Ads → Marketing tab. One row per campaign per month.
 * Setup: Meta Business Settings → System Users → generate a token with ads_read for the ad account(s).
 * META_AD_ACCOUNT_IDS = comma-separated numeric ids (without "act_").
 */
const LEAD_ACTIONS = ['lead', 'onsite_conversion.lead_grouped', 'offsite_conversion.fb_pixel_lead', 'leadgen_grouped'];

export async function syncMeta(): Promise<number> {
  const v = process.env.META_API_VERSION || 'v21.0';
  const token = process.env.META_ACCESS_TOKEN!;
  const company = process.env.META_COMPANY === 'Anderson' ? 'Anderson' : 'Andreal';
  const accounts = (process.env.META_AD_ACCOUNT_IDS || '').split(',').map((s) => s.trim().replace(/^act_/, '')).filter(Boolean);
  let count = 0;
  for (const acct of accounts) {
    for (const m of syncMonths()) {
      let url: string | null = `https://graph.facebook.com/${v}/act_${acct}/insights?` + new URLSearchParams({
        level: 'campaign',
        fields: 'campaign_id,campaign_name,objective,spend,impressions,reach,clicks,inline_link_clicks,actions',
        time_range: JSON.stringify({ since: m.since, until: m.until }),
        limit: '200',
        access_token: token,
      });
      while (url) {
        const body: any = await fetchJson(url);
        for (const row of body.data ?? []) {
          const actions: any[] = row.actions ?? [];
          const leads = actions.filter((a) => LEAD_ACTIONS.includes(a.action_type)).reduce((s, a) => Math.max(s, Number(a.value) || 0), 0);
          const engagements = actions.find((a) => a.action_type === 'post_engagement')?.value;
          await upsertExternal('marketing', 'meta', `meta:${row.campaign_id}:${m.month}`, {
            company,
            campaignName: `${row.campaign_name} (${m.month})`,
            channel: 'Meta',
            objective: mapObjective(row.objective),
            startDate: m.since,
            endDate: m.until,
            actualSpend: Number(row.spend) || 0,
            impressions: Number(row.impressions) || 0,
            reach: Number(row.reach) || 0,
            clicks: Number(row.inline_link_clicks ?? row.clicks) || 0,
            engagements: engagements ? Number(engagements) : undefined,
            leads,
          });
          count++;
        }
        url = body.paging?.next ?? null;
      }
    }
  }
  return count;
}

function mapObjective(o?: string) {
  const s = (o ?? '').toUpperCase();
  if (s.includes('LEAD')) return 'Lead Generation';
  if (s.includes('AWARENESS') || s.includes('REACH')) return 'Awareness';
  if (s.includes('SALES') || s.includes('CONVERSION')) return 'Conversion';
  if (s.includes('ENGAGEMENT') || s.includes('TRAFFIC')) return 'Trust Building';
  return undefined;
}
