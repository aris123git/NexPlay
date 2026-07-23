'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { useAuth } from '@/lib/auth';

const tabs = [
  { href: '/', label: 'Lobby' },
  { href: '/play', label: 'Jouer' },
  { href: '/leaderboard', label: 'Rang' },
  { href: '/profile', label: 'Profil' },
];

export function Shell({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();
  const { session } = useAuth();
  const hideNav = pathname.startsWith('/match/') || pathname.startsWith('/auth');

  return (
    <div className="app-shell">
      <header className="topbar">
        <Link href="/" className="brand">
          NexPlay
        </Link>
        {session ? (
          <span className="muted" style={{ fontSize: '0.85rem' }}>
            @{session.user.username} · Lv.{session.user.level}
          </span>
        ) : (
          <Link href="/auth" className="btn-ghost">
            Connexion
          </Link>
        )}
      </header>
      <main className="page fade-in">{children}</main>
      {!hideNav && (
        <nav className="nav-tabs">
          {tabs.map((t) => (
            <Link
              key={t.href}
              href={t.href}
              className={pathname === t.href ? 'active' : undefined}
            >
              {t.label}
            </Link>
          ))}
        </nav>
      )}
    </div>
  );
}
