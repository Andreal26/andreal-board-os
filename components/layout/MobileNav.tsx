'use client';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { useEffect, useState } from 'react';

interface Props { user: { name: string; role: string; company: string }; depts: { href: string; label: string }[] }

/** Phone / tablet header: logo + menu button that opens a full navigation drawer. */
export default function MobileNav({ user, depts }: Props) {
  const [open, setOpen] = useState(false);
  const path = usePathname();
  useEffect(() => setOpen(false), [path]);
  useEffect(() => {
    document.body.style.overflow = open ? 'hidden' : '';
    return () => { document.body.style.overflow = ''; };
  }, [open]);

  const groups: { title?: string; links: { href: string; label: string }[] }[] = [
    { links: [{ href: '/', label: 'Executive summary' }, { href: '/departments', label: 'Department summary' }, { href: '/alerts', label: 'Alerts' }, { href: '/reports/weekly', label: 'Weekly board pack' }] },
    { title: 'Department data', links: depts },
    { title: 'Control', links: [{ href: '/targets', label: 'Targets' }, { href: '/settings', label: 'Settings' }] },
  ];
  const active = (href: string) => (href === '/' ? path === '/' : path === href || path.startsWith(href + '/'));
  const current = groups.flatMap((g) => g.links).find((l) => active(l.href))?.label;

  return (
    <>
      <header className="no-print sticky top-0 z-30 flex items-center gap-3 border-b border-ink-700 bg-ink-900/95 px-3 py-2.5 backdrop-blur lg:hidden">
        <button aria-label="Open menu" onClick={() => setOpen(true)} className="grid h-9 w-9 place-items-center rounded-lg border border-ink-600 text-gray-200">
          <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M3 6h18M3 12h18M3 18h18" /></svg>
        </button>
        <Link href="/" className="h-display whitespace-nowrap text-lg">BOARD <span className="text-coral-500">OS</span></Link>
        {current && <span className="ml-auto truncate text-xs text-gray-400">{current}</span>}
      </header>

      {open && (
        <div className="fixed inset-0 z-50 lg:hidden" role="dialog" aria-modal="true">
          <div className="absolute inset-0 bg-black/60" onClick={() => setOpen(false)} />
          <aside className="absolute inset-y-0 left-0 flex w-[82%] max-w-xs flex-col border-r border-ink-700 bg-ink-900 shadow-2xl">
            <div className="flex items-center justify-between px-5 pb-3 pt-4">
              <div>
                <div className="kicker">Andreal · Anderson</div>
                <div className="h-display text-2xl">BOARD <span className="text-coral-500">OS</span></div>
              </div>
              <button aria-label="Close menu" onClick={() => setOpen(false)} className="grid h-9 w-9 place-items-center rounded-lg border border-ink-600 text-gray-300">✕</button>
            </div>
            <nav className="flex-1 space-y-5 overflow-y-auto px-3 pb-6 text-[15px]">
              {groups.map((g, i) => (
                <div key={i}>
                  {g.title && <div className="px-3 pb-1 text-[11px] uppercase tracking-wider text-ink-500">{g.title}</div>}
                  <div className="space-y-0.5">
                    {g.links.map((l) => (
                      <Link key={l.href} href={l.href}
                        className={`block rounded-lg px-3 py-2.5 ${active(l.href) ? 'bg-teal-500/10 text-teal-300' : 'text-gray-200 active:bg-ink-800'}`}>
                        {l.label}
                      </Link>
                    ))}
                  </div>
                </div>
              ))}
            </nav>
            <div className="border-t border-ink-700 px-5 py-4 text-sm">
              <div className="font-medium text-gray-200">{user.name}</div>
              <div className="text-xs text-ink-500">{user.role}{user.company !== 'All' ? ` · ${user.company}` : ''}</div>
              <form action="/api/auth/logout" method="post" className="mt-2">
                <button className="text-teal-400">Sign out</button>
              </form>
            </div>
          </aside>
        </div>
      )}
    </>
  );
}
