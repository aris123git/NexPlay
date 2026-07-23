'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { useAuth } from '@/lib/auth';
import { useNotifications } from '@/lib/notifications';

const tabs = [
  { href: '/', label: 'Lobby' },
  { href: '/play', label: 'Jouer' },
  { href: '/compete', label: 'Compétir' },
  { href: '/profile', label: 'Profil' },
];

export function Shell({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();
  const { session } = useAuth();
  const { unread } = useNotifications();
  const hideNav = pathname.startsWith('/match/') || pathname.startsWith('/auth');

  return (
    <div className="app-shell">
      <header className="topbar">
        <Link href="/" className="brand">
          NexPlay
        </Link>
        <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
          {session ? (
            <>
              <Link href="/notifications" className="btn-ghost" style={{ position: 'relative' }}>
                Notifs
                {unread > 0 ? <span className="notif-dot">{unread > 9 ? '9+' : unread}</span> : null}
              </Link>
              <span className="muted" style={{ fontSize: '0.85rem' }}>
                @{session.user.username}
              </span>
            </>
          ) : (
            <Link href="/auth" className="btn-ghost">
              Connexion
            </Link>
          )}
        </div>
      </header>
      <main className="page fade-in">{children}</main>
      {!hideNav && (
        <nav className="nav-tabs">
          {tabs.map((t) => (
            <Link
              key={t.href}
              href={t.href}
              className={pathname === t.href || (t.href !== '/' && pathname.startsWith(t.href)) ? 'active' : undefined}
            >
              {t.label}
            </Link>
          ))}
        </nav>
      )}
    </div>
  );
}
