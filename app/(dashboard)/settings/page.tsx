import { requireUser, isAdmin } from '@/server/auth';
import { query } from '@/db/client';
import { INTEGRATIONS, integrationStatus } from '@/server/integrations';
import { zohoConnection, zohoRedirectUri } from '@/server/integrations/zoho-oauth';
import ZohoDisconnectButton from '@/components/admin/ZohoDisconnectButton';
import AccountsSheetConnect from '@/components/admin/AccountsSheetConnect';
import { accountsSheetConnection } from '@/server/integrations/accounts-sheet';
import { mailConfigured, boardEmails } from '@/server/mailer';
import UsersAdmin from '@/components/admin/UsersAdmin';
import ChangePassword from '@/components/admin/ChangePassword';
import RunJobButton from '@/components/admin/RunJobButton';
import DemoDataButtons from '@/components/admin/DemoDataButtons';
import { jobDefs, jobStates } from '@/server/scheduler';
import { demoCount } from '@/server/seed';

export default async function SettingsPage({ searchParams }: { searchParams: Promise<{ zoho?: string }> }) {
  const zohoMsg = (await searchParams).zoho;
  const user = await requireUser();
  const admin = isAdmin(user);
  const users = admin ? await query(`SELECT id, email, name, role, departments, company, active, last_login_at FROM users ORDER BY id`) : [];
  const runs = admin ? await query<{ id: number; integration: string; started_at: string; status: string; rows: number; message: string }>(`SELECT * FROM sync_runs ORDER BY id DESC LIMIT 15`) : [];
  const audit = admin ? await query<{ at: string; action: string; dept: string; record_id: number; name: string }>(
    `SELECT a.at, a.action, a.dept, a.record_id, u.name FROM audit_log a LEFT JOIN users u ON u.id = a.user_id ORDER BY a.id DESC LIMIT 20`) : [];
  const db = process.env.DATABASE_URL
    ? 'External Postgres (DATABASE_URL)'
    : `Built-in database at ${process.env.PGLITE_DIR || './data/db'}${(process.env.PGLITE_DIR || '').startsWith('/data') ? ' (Hugging Face persistent storage)' : ''}`;
  const states = admin ? new Map((await jobStates()).map((j) => [j.job, j])) : new Map();
  const demoRows = admin ? await demoCount() : 0;
  const schedulerOn = process.env.SCHEDULER_ENABLED !== 'false' && process.env.NODE_ENV === 'production';
  const statuses = admin ? await Promise.all(INTEGRATIONS.map((i) => integrationStatus(i))) : [];
  const zoho = admin ? await zohoConnection() : null;
  const sheet = admin ? await accountsSheetConnection() : null;
  const ZOHO_MSG: Record<string, [string, string]> = {
    connected: ['text-rag-green', 'Zoho connected. Click "Sync integrations → Run now" to pull deals immediately, or wait for the daily sync.'],
    denied: ['text-rag-amber', 'Zoho connection was cancelled on the Zoho screen.'],
    'bad-state': ['text-rag-red', 'Zoho connection expired — click Connect Zoho again.'],
    failed: ['text-rag-red', 'Zoho rejected the connection. Check ZOHO_CLIENT_ID / ZOHO_CLIENT_SECRET and that the client\'s redirect URI matches the one shown below.'],
    'missing-keys': ['text-rag-amber', 'Add the ZOHO_CLIENT_ID and ZOHO_CLIENT_SECRET secrets in the Space settings first.'],
  };

  return (
    <div className="space-y-6">
      <div>
        <div className="kicker">Control</div>
        <h1 className="h-display mt-1 text-3xl">Settings</h1>
      </div>

      <ChangePassword />

      {admin && (
        <>
          <section className="card card-pad space-y-3">
            <h2 className="text-sm font-medium text-white">System</h2>
            <dl className="grid gap-2 text-sm md:grid-cols-2">
              <div><dt className="text-gray-500">Database</dt><dd>{db}</dd></div>
              <div><dt className="text-gray-500">Email</dt><dd>{mailConfigured() ? `SMTP configured · board recipients: ${boardEmails().join(', ') || 'none set (BOARD_EMAILS)'}` : 'SMTP not configured — emails are logged only'}</dd></div>
            </dl>
            <h3 className="pt-2 text-xs font-medium uppercase tracking-wider text-gray-400">
              Scheduled jobs — built-in scheduler {schedulerOn ? <span className="text-rag-green">● running</span> : <span className="text-gray-500">○ off (starts in production unless SCHEDULER_ENABLED=false)</span>} · India time
            </h3>
            <table className="tbl">
              <thead><tr><th>Job</th><th>Runs</th><th>Last run</th><th>Result</th><th></th></tr></thead>
              <tbody>
                {jobDefs().map((d) => {
                  const st = states.get(d.job);
                  return (
                    <tr key={d.job}>
                      <td>{d.label}</td>
                      <td className="text-xs">{d.weekday !== undefined ? ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'][d.weekday] + 's' : 'Daily'} {String(d.hh).padStart(2, '0')}:{String(d.mm).padStart(2, '0')}</td>
                      <td className="text-xs">{st?.updated_at ? new Date(st.updated_at).toLocaleString('en-GB') : 'never'}</td>
                      <td className={`max-w-xs truncate text-xs ${st?.last_status === 'error' ? 'text-rag-red' : 'text-gray-400'}`}>{st?.last_message ?? ''}</td>
                      <td><RunJobButton job={d.job} label="Run now" /></td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
            <h3 className="pt-2 text-xs font-medium uppercase tracking-wider text-gray-400">Demo data</h3>
            <p className="text-xs text-gray-500">Demo rows are marked source = &quot;demo&quot; so you can show the board before real data is entered, then remove them in one click.</p>
            <DemoDataButtons demoRows={demoRows} />
          </section>

          <section className="card card-pad">
            <h2 className="mb-3 text-sm font-medium text-white">Integrations</h2>
            {zohoMsg && ZOHO_MSG[zohoMsg] && <p className={`mb-3 text-sm ${ZOHO_MSG[zohoMsg][0]}`}>{ZOHO_MSG[zohoMsg][1]}</p>}
            <table className="tbl">
              <thead><tr><th>Integration</th><th>Feeds</th><th>Status</th></tr></thead>
              <tbody>
                {INTEGRATIONS.map((i, idx) => {
                  const s = statuses[idx];
                  const isZoho = i.key === 'zoho';
                  const isSheet = i.key === 'accounts_sheet';
                  const since = isZoho ? zoho?.connectedAt : isSheet ? sheet?.connectedAt : null;
                  return (
                    <tr key={i.key}>
                      <td className="font-medium">{i.name}</td>
                      <td className="whitespace-normal text-gray-400">{i.feeds}</td>
                      <td className="whitespace-normal text-xs">
                        {s.ready ? (
                          <span className="text-rag-green">● Connected{since ? ` since ${new Date(since).toLocaleDateString('en-GB')}` : ''}</span>
                        ) : s.missing.length ? (
                          <span className="text-rag-amber">▲ Add secrets: {s.missing.join(', ')}</span>
                        ) : isZoho && !s.connected ? (
                          <span className="text-rag-amber">▲ Keys added — not connected yet</span>
                        ) : isSheet && !s.connected ? (
                          <span className="text-rag-amber">▲ Paste the Apps Script link below</span>
                        ) : (
                          <span className="text-gray-400">○ Off — set {i.envFlag}=true</span>
                        )}
                        {isZoho && !s.missing.length && (
                          <div className="mt-2 flex flex-wrap items-center gap-2">
                            <a className="btn-primary px-3 py-1 text-xs" href="/api/integrations/zoho/connect">{s.connected ? 'Reconnect Zoho' : 'Connect Zoho'}</a>
                            {zoho?.source === 'database' && <ZohoDisconnectButton />}
                          </div>
                        )}
                        {isSheet && s.enabled && (
                          <div className="mt-2"><AccountsSheetConnect connected={s.connected} fromDb={sheet?.source === 'database'} /></div>
                        )}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
            <p className="mt-3 text-xs text-gray-500">
              Zoho setup: in api-console.zoho.in create a <b>Server-based Application</b> with redirect URI <code className="text-teal-300">{zohoRedirectUri()}</code>,
              add its keys as the <code>ZOHO_CLIENT_ID</code> / <code>ZOHO_CLIENT_SECRET</code> Space secrets, then click Connect Zoho.
              <br />Accounts sheet setup: paste <code>docs/apps-script/accounts-sheet.gs</code> into the sheet&apos;s Extensions → Apps Script, deploy it as a
              Web app (Execute as: Me · Access: Anyone), run <code>showBoardOsLink</code> and paste the logged link above.
            </p>
            {!!runs.length && (
              <>
                <h3 className="mb-2 mt-4 text-xs font-medium uppercase tracking-wider text-gray-400">Recent sync runs</h3>
                <table className="tbl">
                  <tbody>
                    {runs.map((r) => (
                      <tr key={r.id}>
                        <td className="text-xs">{new Date(r.started_at).toLocaleString('en-GB')}</td><td>{r.integration}</td>
                        <td className={r.status === 'ok' ? 'text-rag-green' : r.status === 'error' ? 'text-rag-red' : 'text-gray-400'}>{r.status}</td>
                        <td className="text-right">{r.rows}</td><td className="max-w-md truncate text-xs text-gray-500">{r.message}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </>
            )}
          </section>

          <UsersAdmin users={JSON.parse(JSON.stringify(users))} me={user.id} />

          <section className="card card-pad">
            <h2 className="mb-3 text-sm font-medium text-white">Audit trail (latest 20)</h2>
            <table className="tbl">
              <tbody>
                {audit.map((a, i) => (
                  <tr key={i}><td className="text-xs">{new Date(a.at).toLocaleString('en-GB')}</td><td>{a.name ?? 'system'}</td><td>{a.action}</td><td>{a.dept ?? ''}</td><td>{a.record_id ?? ''}</td></tr>
                ))}
                {!audit.length && <tr><td className="text-ink-500">No activity yet.</td></tr>}
              </tbody>
            </table>
          </section>
        </>
      )}
    </div>
  );
}
