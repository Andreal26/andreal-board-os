import { getBoard } from '@/server/board';
import { evaluateAlerts } from '@/server/alerts';
import { escapeHtml } from '@/lib/utils';
import { snapshotFrom } from '@/server/snapshots';
import { EXECUTIVE_METRICS, METRIC_BY_ID } from '@/config/metrics';
import { vsTarget } from '@/lib/kpi-utils';
import { DEPARTMENTS, DEPT_KEYS } from '@/config/departments';
import { fmt } from '@/lib/format';
import { appUrl, boardEmails, emailShell, sendMail } from '@/server/mailer';

/** Data for the weekly board pack (also rendered at /reports/weekly). */
export async function weeklyPack() {
  const board = await getBoard('All', 'MTD');
  const prev = await snapshotFrom('All', 7);
  const alerts = await evaluateAlerts();
  return { board, prev, alerts };
}

export async function sendWeeklyPack() {
  const { board, prev, alerts } = await weeklyPack();
  const rag = { Green: '#2fbf71', Amber: '#f2a93b', Red: '#ff4e42', 'No data': '#6b7280' };
  const kpiRows = EXECUTIVE_METRICS.map((id) => {
    const m = METRIC_BY_ID[id];
    const v = board.kpis[id];
    const before = prev?.metrics?.[id];
    const delta = v !== null && before !== null && before !== undefined ? v - before : null;
    const t = board.targets[id];
    const st = vsTarget(m, v, t).status;
    const c = st === 'good' ? '#2fbf71' : st === 'watch' ? '#f2a93b' : st === 'bad' ? '#ff4e42' : '#aab1ba';
    return `<tr><td style="padding:6px 8px;border-bottom:1px solid #262c34;font-size:13px">${m.label}</td>
      <td style="padding:6px 8px;border-bottom:1px solid #262c34;font-size:13px;color:${c};text-align:right">${fmt(v, m.unit)}</td>
      <td style="padding:6px 8px;border-bottom:1px solid #262c34;font-size:12px;color:#aab1ba;text-align:right">${t !== undefined ? fmt(t, m.unit) : '—'}</td>
      <td style="padding:6px 8px;border-bottom:1px solid #262c34;font-size:12px;color:#aab1ba;text-align:right">${delta === null ? '—' : (delta > 0 ? '+' : '') + fmt(delta, m.unit)}</td></tr>`;
  }).join('');
  const health = DEPT_KEYS.map((d) => `<tr><td style="padding:6px 8px;border-bottom:1px solid #262c34;font-size:13px">${DEPARTMENTS[d].name}</td>
    <td style="padding:6px 8px;border-bottom:1px solid #262c34;font-size:13px;color:${rag[board.health[d].rag]}">${board.health[d].rag}</td>
    <td style="padding:6px 8px;border-bottom:1px solid #262c34;font-size:12px;color:#aab1ba">${escapeHtml(board.health[d].reason)}</td></tr>`).join('');
  const high = alerts.filter((a) => a.severity === 'high').slice(0, 10)
    .map((a) => `<li style="margin:4px 0;font-size:13px"><b>${DEPARTMENTS[a.dept].short}</b> · ${escapeHtml(a.title)} — ${escapeHtml(a.message)}</li>`).join('');
  const table = (head: string, rows: string) => `<table style="width:100%;border-collapse:collapse;background:#161a1f;margin:8px 0 20px">${head}${rows}</table>`;
  const html = emailShell(`Weekly board pack — ${board.period.label}`, `
    <h2 style="font-size:15px;color:#3fd6c8">Department health</h2>${table('', health)}
    <h2 style="font-size:15px;color:#3fd6c8">Key numbers (vs target, change vs last week)</h2>
    ${table('<tr style="color:#8a929c;font-size:11px;text-align:right"><td></td><td>Actual</td><td>Target</td><td>Δ 7 days</td></tr>', kpiRows)}
    <h2 style="font-size:15px;color:#ff4e42">High-severity alerts</h2><ul style="padding-left:18px">${high || '<li>None</li>'}</ul>
    <p style="font-size:13px">Full printable pack: <a style="color:#3fd6c8" href="${appUrl()}/reports/weekly">${appUrl()}/reports/weekly</a></p>`);
  const r = await sendMail(boardEmails(), `Weekly board pack — ${new Date().toLocaleDateString('en-GB')}`, html);
  return { sent: r.sent, info: r.info };
}
