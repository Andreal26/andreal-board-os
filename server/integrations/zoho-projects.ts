import { query } from '@/db/client';
import { upsertExternal } from '@/server/records';
import { fetchJson } from '@/server/integrations/shared';
import { zohoAccessToken, zohoConnection } from '@/server/integrations/zoho-oauth';
import type { RecordData } from '@/types';

/**
 * Zoho Projects → Operations tab. One row per project (Projects tab), active and archived, from every portal
 * the connected user can see (or only ZOHO_PROJECTS_PORTAL_IDS). Rows deleted in Zoho are removed on the next sync.
 * Setup: Settings → Integrations → "Connect Zoho Projects" (uses the same ZOHO_CLIENT_ID / ZOHO_CLIENT_SECRET).
 */
const SOURCE = 'zohoprojects';

/** projectsapi host for the account's data centre (accounts.zoho.in → projectsapi.zoho.in). */
async function apiBase() {
  if (process.env.ZOHO_PROJECTS_API_URL) return process.env.ZOHO_PROJECTS_API_URL.replace(/\/$/, '');
  const { accountsUrl } = await zohoConnection('projects');
  return accountsUrl.replace('://accounts.', '://projectsapi.');
}

async function get(token: string, path: string) {
  return fetchJson(`${await apiBase()}/restapi${path}`, { headers: { Authorization: `Zoho-oauthtoken ${token}` } });
}

export async function zohoProjectsPortals(token: string): Promise<{ id: string; name: string }[]> {
  const body: any = await get(token, '/portals/');
  const only = (process.env.ZOHO_PROJECTS_PORTAL_IDS || '').split(',').map((s) => s.trim()).filter(Boolean);
  return (body.portals ?? [])
    .map((p: any) => ({ id: String(p.id_string ?? p.id), name: String(p.name ?? '') }))
    .filter((p: { id: string }) => !only.length || only.includes(p.id));
}

export async function fetchPortalProjects(token: string, portalId: string, statuses = ['active']): Promise<any[]> {
  const out: any[] = [];
  for (const status of statuses) {
    for (let index = 1; index < 10_000; index += 100) {
      const body: any = await get(token, `/portal/${portalId}/projects/?` + new URLSearchParams({ index: String(index), range: '100', status }));
      const list: any[] = body.projects ?? [];
      out.push(...list.map((p) => ({ ...p, _archived: status === 'archived' })));
      if (list.length < 100) break;
    }
  }
  return out;
}

/** All open tasks (subtasks included) across the portal — v3 API, 100 per page. */
export async function fetchOpenTasks(token: string, portalId: string): Promise<any[]> {
  const filter = JSON.stringify({ criteria: [{ field_name: 'status', criteria_condition: 'custom_condition', value: ['${ALL_OPEN}'] }], pattern: '1' });
  const out: any[] = [];
  for (let page = 1; page <= 100; page++) {
    const body: any = await fetchJson(`${await apiBase()}/api/v3/portal/${portalId}/tasks?` + new URLSearchParams({ page: String(page), per_page: '100', filter }), {
      headers: { Authorization: `Zoho-oauthtoken ${token}` },
    });
    const list: any[] = body.tasks ?? [];
    out.push(...list);
    if (!body.page_info?.has_next_page || !list.length) break;
  }
  return out;
}

export interface TaskStats { openTasks: number; openTasksThisMonth: number; tasksDueToday: number; tasksOverdue: number; tasksOverdue30: number; postingNotDoneLastWeek: number }
const emptyStats = (): TaskStats => ({ openTasks: 0, openTasksThisMonth: 0, tasksDueToday: 0, tasksOverdue: 0, tasksOverdue30: 0, postingNotDoneLastWeek: 0 });

/** Monday–Sunday of the previous week (IST dates). */
export function lastWeek(today: string) {
  const d = new Date(`${today}T00:00:00Z`);
  const dow = (d.getUTCDay() + 6) % 7; // 0 = Monday
  const mon = new Date(d.getTime() - (dow + 7) * 86_400_000);
  const sun = new Date(mon.getTime() + 6 * 86_400_000);
  return { from: mon.toISOString().slice(0, 10), to: sun.toISOString().slice(0, 10) };
}

const istDate = (iso: unknown) => (iso ? new Date(Date.parse(String(iso)) + 5.5 * 3600_000).toISOString().slice(0, 10) : null);

/**
 * Per project, matching the Zoho "Global Dashboard" widgets:
 * - openTasksThisMonth ("All Over Open Tasks"): open tasks due in the current calendar month
 * - tasksDueToday ("Open Tasks Due Today")
 * - postingNotDoneLastWeek: open tasks owned by the posting team (ZOHO_POSTING_OWNERS, default Susmita|Prithwish)
 *   in Digital Marketing / Campaign projects, due last week Mon–Sun
 * plus all open tasks and overdue counts. Subtasks are included, as in Zoho's task views.
 */
export function taskStats(tasks: any[], today: string, projectCategory: Map<string, string> = new Map()): Map<string, TaskStats> {
  const lw = lastWeek(today);
  const month = today.slice(0, 7);
  const owners = new RegExp(process.env.ZOHO_POSTING_OWNERS || 'susmita|prithwish', 'i');
  const postingProjects = ['Digital Marketing', 'Campaign'];
  const out = new Map<string, TaskStats>();
  for (const t of tasks) {
    const key = str(t.project?.id) || str(t.project?.name);
    const st = out.get(key) ?? emptyStats();
    const due = istDate(t.end_date);
    const ownerNames: string[] = (t.owners_and_work?.owners ?? []).map((o: any) => `${str(o.name)} ${str(o.email)}`);
    st.openTasks++;
    if (due && due.slice(0, 7) === month) st.openTasksThisMonth++;
    if (due === today) st.tasksDueToday++;
    if (due && due < today) {
      st.tasksOverdue++;
      if ((Date.parse(today) - Date.parse(due)) / 86_400_000 > 30) st.tasksOverdue30++;
    }
    const cat = projectCategory.get(key) ?? projectCategory.get(str(t.project?.name)) ?? '';
    if (due && due >= lw.from && due <= lw.to && ownerNames.some((n) => owners.test(n)) && postingProjects.includes(cat)) st.postingNotDoneLastWeek++;
    out.set(key, st);
  }
  return out;
}

// ── mapping ──────────────────────────────────────────────────
const str = (v: unknown) => (v === null || v === undefined ? '' : String(v).trim());
const todayIst = () => new Date(Date.now() + 5.5 * 3600_000).toISOString().slice(0, 10);

/** Zoho returns dates as epoch-ms "*_long" fields plus MM-dd-yyyy strings. */
function dateOf(p: any, key: 'start_date' | 'end_date' | 'created_date' | 'updated_date'): string | undefined {
  const long = Number(p[`${key}_long`]);
  if (Number.isFinite(long) && long > 0) return new Date(long + 5.5 * 3600_000).toISOString().slice(0, 10);
  const m = str(p[key]).match(/^(\d{2})-(\d{2})-(\d{4})/);
  return m ? `${m[3]}-${m[1]}-${m[2]}` : undefined;
}

function customField(p: any, labels: string[]): string {
  const list: any[] = Array.isArray(p.custom_fields) ? p.custom_fields : [];
  for (const f of list) {
    const label = str(f.label_name ?? f.column_name ?? Object.keys(f)[0]).toLowerCase();
    if (labels.includes(label)) return str(f.value ?? Object.values(f)[0]);
  }
  return '';
}

const MONTHS = 'jan|feb|mar|apr|may|jun|jul|aug|sep|sept|oct|nov|dec|january|february|march|april|june|july|august|september|october|november|december';
/** "Baldwin Patna DM Dec 2026" → client "Baldwin Patna", service "Digital Marketing". */
export function splitProjectName(name: string): { client: string; service: string } {
  const services: [RegExp, string][] = [
    [/\bDM\b/i, 'Digital Marketing'], [/\bAMC\b/i, 'Website AMC'], [/\bSEO\b/i, 'SEO'], [/\bchat ?bot\b/i, 'Chatbot'],
    [/\bwebsite\b/i, 'Website'], [/\bcalendar\b/i, 'Calendar / Print'], [/\bAR\b|\bVR\b|immersive|walkthrough/i, 'Immersive'],
    [/\bshoot\b|photo/i, 'Photography'], [/\bvideo\b|reel/i, 'Video'], [/walk ?through/i, 'Immersive'],
    [/catalogue|catalog|brochure/i, 'Design'],
  ];
  const service = services.find(([re]) => re.test(name))?.[1] ?? '';
  const client = name
    .replace(new RegExp(`\\b(${MONTHS})\\b\\.?`, 'gi'), ' ')
    .replace(/\b(19|20)\d{2}\b|\b\d{2}\b/g, ' ')
    .replace(/\b(DM|AMC|SEO|Chatbot|Informative|Website|Calendar|Walk ?Through|Product Catalogue|Catalogue)\b/gi, ' ')
    .replace(/[-–—_/]+/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
  return { client: client || name, service };
}

const DONE = /complet|closed|deliver|done|invoic|cancel/i;

/** Project groups ("DM July 2026", "AMC WEBSITE", "DESIGN PROJECTS"…) → department-style service. */
export function groupCategory(group: string): string {
  const g = group.toLowerCase();
  if (!g || /ungroup/.test(g)) return '';
  if (/\bamc\b/.test(g)) return 'Website AMC';
  if (/^dm\b|digital|\bsmo\b|\bseo\b/.test(g)) return 'Digital Marketing';
  if (/website|web\b/.test(g)) return 'Website';
  if (/design/.test(g)) return 'Design';
  if (/immersive|\bar\b|\bvr\b/.test(g)) return 'Immersive';
  if (/campa/.test(g)) return 'Campaign';
  if (/print|calendar/.test(g)) return 'Print / Production';
  if (/internal|admin/.test(g)) return 'Internal';
  return '';
}

const INTERNAL = /\b(internal|admin project|it project|pitching|research ?and ?development|andreal portfolio|lead (sheet )?update|meta audience)\b|^(andreal|anderson)\b/i;

export function mapProject(p: any, portalName: string, today = todayIst()): RecordData {
  const name = str(p.name);
  const statusName = str(p.custom_status_name ?? p.status);
  const archived = !!p._archived || /archiv/i.test(str(p.status));
  const done = archived || DONE.test(statusName);
  const start = dateOf(p, 'start_date');
  const end = dateOf(p, 'end_date');
  const open = Number(p.task_count?.open) || 0;
  const closed = Number(p.task_count?.closed) || 0;
  const pctField = Number(p.percent_complete ?? p.project_percent);
  const completion = Number.isFinite(pctField) && pctField > 0 ? pctField : open + closed ? Math.round((closed / (open + closed)) * 100) : done ? 100 : undefined;
  const overdue = !done && !!end && end < today;
  const delay = overdue ? Math.round((Date.parse(today) - Date.parse(end!)) / 86_400_000) : 0;

  let deliveryStatus = 'On Track';
  if (done) deliveryStatus = /invoic|closed|cancel/i.test(statusName) || archived ? 'Closed' : 'Delivered';
  else if (/delay|overdue/i.test(statusName) || overdue) deliveryStatus = 'Delayed';
  else if (/hold|risk|block/i.test(statusName)) deliveryStatus = 'At Risk';

  const s = statusName.toLowerCase();
  const stage = done ? (/invoic/.test(s) ? 'Billing' : 'Closed')
    : /plan|brief|not started|open/.test(s) ? 'Planning'
    : /approv|review|feedback/.test(s) ? 'Client Approval'
    : /test|qc|qa/.test(s) ? 'QC'
    : 'Production';

  const fromName = splitProjectName(name);
  const client = customField(p, ['client', 'client name', 'customer', 'account']) || str(p.client_name ?? p.client?.name) || (INTERNAL.test(name) ? 'Internal' : fromName.client);
  const team = groupCategory(str(p.group_name));
  const service = customField(p, ['service', 'service type', 'category', 'type', 'project type']) || (team !== 'Internal' ? team : '') || fromName.service || team;
  const internal = team === 'Internal' || INTERNAL.test(name);
  const andersonHint = /anderson/i.test(customField(p, ['company', 'work done for', 'billing company']) || '') || /^anderson\b/i.test(name);
  const issues = Number(p.bug_count?.open) || 0;
  const hours = (v: unknown) => { const m = str(v).match(/^(\d+)[.:](\d{2})$/); const h = m ? Number(m[1]) + Number(m[2]) / 60 : Number(v); return Number.isFinite(h) && h > 0 ? Math.round(h * 10) / 10 : undefined; };

  return {
    company: andersonHint ? 'Anderson' : (process.env.ZOHO_PROJECTS_COMPANY === 'Anderson' ? 'Anderson' : 'Andreal'),
    clientName: client,
    jobId: str(p.key) || str(p.id_string ?? p.id),
    jobName: name,
    serviceType: service || undefined,
    owner: str(p.owner_name) || undefined,
    startDate: start,
    committedDate: end,
    stage,
    completionPct: completion,
    plannedHours: hours(p.planned_hours),
    actualHours: hours(p.actual_hours),
    deliveryStatus,
    assignedTeam: team || (/ungroup/i.test(str(p.group_name)) ? undefined : str(p.group_name) || undefined),
    riskLevel: done ? 'Low' : delay > 14 ? 'High' : delay > 0 || deliveryStatus === 'At Risk' ? 'Medium' : 'Low',
    notes: [
      `Zoho Projects (${portalName})`,
      statusName && `status ${statusName}`,
      open + closed ? `${closed}/${open + closed} tasks closed` : 'no tasks',
      issues ? `${issues} open issues` : '',
      archived ? 'archived' : '',
      internal ? 'internal project' : '',
      str(p.group_name) && `group ${str(p.group_name)}`,
    ].filter(Boolean).join('; '),
  };
}

/** Only live work reaches the Operations tab: active (not archived) projects that are not Completed/Cancelled/Invoiced. */
export const isLiveProject = (p: any) => !p._archived && !DONE.test(str(p.custom_status_name ?? p.status));

export async function syncZohoProjects(): Promise<number> {
  const token = await zohoAccessToken('projects');
  const portals = await zohoProjectsPortals(token);
  if (!portals.length) throw new Error('No Zoho Projects portal visible to the connected user');
  const today = todayIst();
  const ids: string[] = [];
  for (const portal of portals) {
    const live = (await fetchPortalProjects(token, portal.id)).filter(isLiveProject);
    const category = new Map<string, string>();
    for (const p of live) {
      const cat = groupCategory(str(p.group_name)) || splitProjectName(str(p.name)).service;
      for (const k of [str(p.id), str(p.id_string), str(p.name)]) if (k) category.set(k, cat);
    }
    const stats = taskStats(await fetchOpenTasks(token, portal.id), today, category);
    for (const p of live) {
      const id = `${portal.id}:${str(p.id_string ?? p.id)}`;
      const ts = stats.get(str(p.id)) ?? stats.get(str(p.id_string)) ?? stats.get(str(p.name)) ?? emptyStats();
      const data = Object.fromEntries(Object.entries({ ...mapProject(p, portal.name, today), ...ts } as RecordData).filter(([, v]) => v !== undefined && v !== ''));
      await upsertExternal('operations', SOURCE, id, data as RecordData);
      ids.push(id);
    }
  }
  if (ids.length)
    await query(`DELETE FROM records WHERE dept = 'operations' AND source = $1 AND NOT (external_id IN (SELECT jsonb_array_elements_text($2::jsonb)))`, [SOURCE, JSON.stringify(ids)]);
  return ids.length;
}

/** Admin diagnostics: raw read-only GET against the Zoho Projects API ({portal} is replaced by the first portal id). */
export async function zohoProjectsRaw(path: string) {
  if (!/^\/(api\/v3|restapi)\//.test(path)) throw new Error('path must start with /api/v3/ or /restapi/');
  const token = await zohoAccessToken('projects');
  const portals = await zohoProjectsPortals(token);
  const url = `${await apiBase()}${path.replace('{portal}', portals[0]?.id ?? '')}`;
  const res = await fetch(url, { headers: { Authorization: `Zoho-oauthtoken ${token}` }, cache: 'no-store' });
  const text = await res.text();
  let body: unknown; try { body = JSON.parse(text); } catch { body = text.slice(0, 2000); }
  return { status: res.status, rateRemaining: res.headers.get('ratelimit-remaining'), body };
}

/** Admin diagnostics: portals and the raw fields of a couple of projects, or the tasks of one project. */
export async function zohoProjectsSample(projectId?: string | null) {
  const token = await zohoAccessToken('projects');
  const portals = await zohoProjectsPortals(token);
  const first = portals[0];
  if (first && projectId) {
    const body: any = await get(token, `/portal/${first.id}/projects/${projectId}/tasks/?index=1&range=200`);
    return { tasks: body.tasks ?? [] };
  }
  const body: any = first ? await get(token, `/portal/${first.id}/projects/?index=1&range=3&status=active`) : {};
  return { apiBase: await apiBase(), portals, sample: body.projects ?? [] };
}
