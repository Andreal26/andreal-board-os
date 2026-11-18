# Integrations

Code: `server/integrations/` (`index.ts` registry, `shared.ts` helpers, one file per platform).
Every integration is **off** until `<NAME>_ENABLED=true` and its keys are set (as Space secrets). Status and the
last 15 runs appear in Settings. Runs daily at `SCHEDULE_SYNC` (default 06:00 IST) or on demand from Settings.

Syncs are idempotent: rows are upserted by `(dept, source, external_id)`. On update the incoming fields are merged
into the existing JSON, so fields people edit by hand (e.g. MQL, SQL, notes on a synced campaign) are kept.

| Integration | File | Writes to | External id |
|---|---|---|---|
| Zoho CRM | `zoho.ts` | Sales — one row per Deal | Zoho deal id |
| Meta Ads | `meta.ts` | Marketing — one row per campaign per month | `meta:<campaign>:<YYYY-MM>` |
| Google Ads | `google-ads.ts` | Marketing — one row per campaign per month | `gads:<customer>:<campaign>:<YYYY-MM>` |
| LinkedIn Ads | `linkedin.ts` | Marketing — one row per campaign per month | `li:<campaign>:<YYYY-MM>` |

Ad platforms sync the previous and the current month on every run, so late-settling numbers are corrected.

## Zoho CRM (one-click connect)
1. https://api-console.zoho.in → **Add Client → Server-based Applications**.
   - Client name: `Board OS` · Homepage URL: `https://<user>-<space>.hf.space`
   - Authorized redirect URI: `https://<user>-<space>.hf.space/api/integrations/zoho/callback`
2. Copy the Client ID and Client Secret into the Space secrets `ZOHO_CLIENT_ID` and `ZOHO_CLIENT_SECRET`
   (the Space restarts).
3. Board OS → **Settings → Integrations → Connect Zoho** → approve on Zoho's screen. The refresh token is stored
   in the database; nobody has to copy it. Use **Sync integrations → Run now** for an immediate sync.
4. Field names: defaults match Andreal's Zoho (`Deal_Status`, `WORK_DONE_FOR`, `Product`, `Prospector`,
   `Reason_For_Loss__s`). Override with `ZOHO_FIELD_*` variables if they change.

Every run refreshes all Deals (≈20 API pages for 4,000 deals). Rows imported earlier from a Zoho CSV export are
adopted by their Zoho deal id, so they are updated instead of duplicated.

## Meta Ads
Business Settings → System users → generate a token with `ads_read` for the ad account(s).
`META_ACCESS_TOKEN`, `META_AD_ACCOUNT_IDS` (numbers, comma-separated, no `act_`), `META_COMPANY`, `META_ENABLED=true`.

## Google Ads
Developer token (API Center of a manager account — Basic/Explorer access is free), an OAuth client in Google Cloud,
and a refresh token with the `adwords` scope. `GOOGLE_ADS_DEVELOPER_TOKEN`, `GOOGLE_ADS_CLIENT_ID`,
`GOOGLE_ADS_CLIENT_SECRET`, `GOOGLE_ADS_REFRESH_TOKEN`, `GOOGLE_ADS_CUSTOMER_IDS` (no dashes), optional
`GOOGLE_ADS_LOGIN_CUSTOMER_ID`, `GOOGLE_ADS_ENABLED=true`. Primary conversions are counted as leads.

## LinkedIn Ads
Developer app with the Advertising API product (`r_ads_reporting`, `r_ads`), a 3-legged OAuth access token
(expires after 60 days — refresh it), `LINKEDIN_ACCESS_TOKEN`, `LINKEDIN_AD_ACCOUNT_IDS`, `LINKEDIN_ENABLED=true`.

## Status
The integrations follow each platform's documented API but have **not yet been run against the live accounts**.
Expect to adjust a field name or API version on the first run — versions are env variables (`ZOHO_API_VERSION`,
`META_API_VERSION`, `GOOGLE_ADS_API_VERSION`, `LINKEDIN_API_VERSION`). Errors are shown in Settings → Recent sync runs.

## Adding an integration
1. Create `server/integrations/<name>.ts` exporting `async function sync<Name>(): Promise<number>` that calls
   `upsertExternal(dept, source, externalId, data)` from `server/records.ts`.
2. Register it in `server/integrations/index.ts` (`INTEGRATIONS` array) with its env flag and required keys.
3. Document the env vars in `.env.example`.
