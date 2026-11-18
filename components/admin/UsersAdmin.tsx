'use client';
import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { DEPARTMENTS, DEPT_KEYS } from '@/config/departments';

interface U { id: number; email: string; name: string; role: string; departments: string[]; company: string; active: boolean; last_login_at: string | null }

const ROLE_HELP: Record<string, string> = {
  admin: 'Everything, incl. users & jobs', ceo: 'Sees all, sets targets & notes', owner: 'Edits assigned departments', viewer: 'Read-only',
};

export default function UsersAdmin({ users, me }: { users: U[]; me: number }) {
  const router = useRouter();
  const blank = { email: '', name: '', password: '', role: 'owner', company: 'All', departments: [] as string[] };
  const [form, setForm] = useState(blank);
  const [msg, setMsg] = useState('');

  async function create(e: React.FormEvent) {
    e.preventDefault();
    setMsg('');
    const res = await fetch('/api/users', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(form) });
    const b = await res.json().catch(() => ({}));
    if (!res.ok) return setMsg(b.error || 'Failed');
    setForm(blank);
    setMsg('User created.');
    router.refresh();
  }

  async function update(id: number, patch: Partial<U> & { password?: string }) {
    const res = await fetch(`/api/users/${id}`, { method: 'PUT', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(patch) });
    const b = await res.json().catch(() => ({}));
    setMsg(res.ok ? 'Updated.' : b.error || 'Failed');
    router.refresh();
  }

  const toggleDept = (list: string[], d: string) => (list.includes(d) ? list.filter((x) => x !== d) : [...list, d]);

  return (
    <section className="card card-pad space-y-4">
      <h2 className="text-sm font-medium text-white">Users & access</h2>
      <div className="overflow-x-auto">
        <table className="tbl">
          <thead><tr><th>Name</th><th>Role</th><th>Company</th><th>Departments (owner edits)</th><th>Active</th><th>Last login</th><th></th></tr></thead>
          <tbody>
            {users.map((u) => (
              <tr key={u.id}>
                <td><div className="text-white">{u.name}</div><div className="text-xs text-gray-500">{u.email}</div></td>
                <td>
                  <select aria-label="Role" className="input w-auto py-1" value={u.role} disabled={u.id === me} onChange={(e) => update(u.id, { role: e.target.value })}>
                    {Object.keys(ROLE_HELP).map((r) => <option key={r}>{r}</option>)}
                  </select>
                </td>
                <td>
                  <select aria-label="Company" className="input w-auto py-1" value={u.company} onChange={(e) => update(u.id, { company: e.target.value })}>
                    {['All', 'Andreal', 'Anderson'].map((c) => <option key={c}>{c}</option>)}
                  </select>
                </td>
                <td className="whitespace-normal">
                  <div className="flex flex-wrap gap-1">
                    {DEPT_KEYS.map((d) => (
                      <button key={d} onClick={() => update(u.id, { departments: toggleDept(u.departments ?? [], d) })}
                        className={`rounded px-2 py-0.5 text-[11px] ${(u.departments ?? []).includes(d) ? 'bg-teal-500/20 text-teal-300' : 'bg-ink-800 text-gray-500'}`}>
                        {DEPARTMENTS[d].short}
                      </button>
                    ))}
                  </div>
                </td>
                <td><input aria-label="Active" type="checkbox" checked={u.active} disabled={u.id === me} onChange={(e) => update(u.id, { active: e.target.checked })} /></td>
                <td className="text-xs text-gray-500">{u.last_login_at ? new Date(u.last_login_at).toLocaleDateString('en-GB') : 'never'}</td>
                <td>
                  <button className="text-xs text-teal-400 hover:underline" onClick={() => { const p = prompt(`New password for ${u.name} (8+ characters)`); if (p) update(u.id, { password: p }); }}>Reset password</button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      <form onSubmit={create} className="grid gap-3 border-t border-ink-700 pt-4 md:grid-cols-3">
        <h3 className="text-xs font-medium uppercase tracking-wider text-gray-400 md:col-span-3">Add user</h3>
        <div><label className="label" htmlFor="nu-name">Name</label><input id="nu-name" className="input" value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} /></div>
        <div><label className="label" htmlFor="nu-email">Email</label><input id="nu-email" type="email" className="input" value={form.email} onChange={(e) => setForm({ ...form, email: e.target.value })} /></div>
        <div><label className="label" htmlFor="nu-pw">Temporary password</label><input id="nu-pw" className="input" value={form.password} onChange={(e) => setForm({ ...form, password: e.target.value })} /></div>
        <div>
          <label className="label" htmlFor="nu-role">Role</label>
          <select id="nu-role" className="input" value={form.role} onChange={(e) => setForm({ ...form, role: e.target.value })}>
            {Object.entries(ROLE_HELP).map(([r, h]) => <option key={r} value={r}>{r} — {h}</option>)}
          </select>
        </div>
        <div>
          <label className="label" htmlFor="nu-co">Company</label>
          <select id="nu-co" className="input" value={form.company} onChange={(e) => setForm({ ...form, company: e.target.value })}>
            {['All', 'Andreal', 'Anderson'].map((c) => <option key={c}>{c}</option>)}
          </select>
        </div>
        <div>
          <span className="label">Departments they own</span>
          <div className="flex flex-wrap gap-1">
            {DEPT_KEYS.map((d) => (
              <button type="button" key={d} onClick={() => setForm({ ...form, departments: toggleDept(form.departments, d) })}
                className={`rounded px-2 py-1 text-xs ${form.departments.includes(d) ? 'bg-teal-500/20 text-teal-300' : 'bg-ink-800 text-gray-500'}`}>{DEPARTMENTS[d].short}</button>
            ))}
          </div>
        </div>
        <div className="flex items-center gap-3 md:col-span-3">
          <button className="btn-primary">Create user</button>
          {msg && <span className="text-sm text-gray-300">{msg}</span>}
        </div>
      </form>
    </section>
  );
}
