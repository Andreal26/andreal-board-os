import Link from 'next/link';
import type { User } from '@/server/auth';
import { canViewDept } from '@/server/auth';
import { DEPARTMENTS, DEPT_KEYS } from '@/config/departments';
import NavLink from '@/components/layout/NavLink';
import MobileNav from '@/components/layout/MobileNav';

export default function Shell({ user, children }: { user: User; children: React.ReactNode }) {
  const depts = DEPT_KEYS.filter((d) => canViewDept(user, d));
  return (
    <div className="flex min-h-screen">
      <aside className="no-print sticky top-0 hidden h-screen w-60 shrink-0 flex-col border-r border-ink-700 bg-ink-900 lg:flex">
        <Link href="/" className="block px-5 pb-4 pt-5">
          <div className="kicker">Andreal · Anderson</div>
          <div className="h-display text-2xl">BOARD <span className="text-coral-500">OS</span></div>
        </Link>
        <nav className="flex-1 space-y-6 overflow-y-auto px-3 pb-6 text-sm">
          <div className="space-y-0.5">
            <NavLink href="/">Executive summary</NavLink>
            <NavLink href="/departments">Department summary</NavLink>
            <NavLink href="/alerts">Alerts</NavLink>
            <NavLink href="/reports/weekly">Weekly board pack</NavLink>
          </div>
          <div>
            <div className="px-3 pb-1 text-[11px] uppercase tracking-wider text-ink-500">Department data</div>
            <div className="space-y-0.5">
              {depts.map((d) => <NavLink key={d} href={`/d/${d}`}>{DEPARTMENTS[d].name}</NavLink>)}
            </div>
          </div>
          <div>
            <div className="px-3 pb-1 text-[11px] uppercase tracking-wider text-ink-500">Control</div>
            <div className="space-y-0.5">
              <NavLink href="/targets">Targets</NavLink>
              <NavLink href="/settings">Settings</NavLink>
            </div>
          </div>
        </nav>
        <div className="border-t border-ink-700 px-5 py-4 text-xs">
          <div className="font-medium text-gray-200">{user.name}</div>
          <div className="text-ink-500">{user.role}{user.company !== 'All' ? ` · ${user.company}` : ''}</div>
          <form action="/api/auth/logout" method="post" className="mt-2">
            <button className="text-teal-400 hover:underline">Sign out</button>
          </form>
        </div>
      </aside>
      <div className="min-w-0 flex-1">
        <MobileNav
          user={{ name: user.name, role: user.role, company: user.company }}
          depts={depts.map((d) => ({ href: `/d/${d}`, label: DEPARTMENTS[d].name }))}
        />
        <main className="mx-auto max-w-[1400px] p-3 sm:p-4 md:p-6">{children}</main>
      </div>
    </div>
  );
}
