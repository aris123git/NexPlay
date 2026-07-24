'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { useEffect, useState } from 'react';
import { useAuth } from '@/lib/auth';
import { useNotifications } from '@/lib/notifications';
import { api } from '@/lib/api';
import { getSocket } from '@/lib/socket';

const tabs = [
  { href: '/', label: 'Lobby' },
  { href: '/play', label: 'Jouer' },
  { href: '/social', label: 'Social' },
  { href: '/compete', label: 'Compétir' },
  { href: '/profile', label: 'Profil' },
];

export function Shell({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();
  const { session } = useAuth();
  const { unread } = useNotifications();
  const [online, setOnline] = useState<number | null>(null);
  const hideNav =
    pathname.startsWith('/match/') ||
    pathname.startsWith('/auth') ||
    pathname.startsWith('/admin');

  useEffect(() => {
    api<{ onlineCount: number }>('/api/presence/stats')
      .then((d) => setOnline(d.onlineCount))
      .catch(() => undefined);
    if (!session) return;
    const socket = getSocket(session.accessToken);
    const onStats = (p: { onlineCount: number }) => setOnline(p.onlineCount);
    socket.on('presence:stats', onStats);
    return () => {
      socket.off('presence:stats', onStats);
    };
  }, [session]);

  return (
    <div className="app-shell">
      <header className="topbar">
        <Link href="/" className="brand">
          NexPlay
        </Link>
        <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
          {online !== null ? (
            <span className="muted" style={{ fontSize: '0.75rem' }}>
              ● {online} en ligne
            </span>
          ) : null}
          {session ? (
            <>
              <Link href="/notifications" className="btn-ghost" style={{ position: 'relative' }}>
                Notifs
                {unread > 0 ? <span className="notif-dot">{unread > 9 ? '9+' : unread}</span> : null}
              </Link>
              {(session.user as { role?: string }).role === 'admin' ||
              (session.user as { role?: string }).role === 'moderator' ? (
                <Link href="/admin" className="btn-ghost">
                  Admin
                </Link>
              ) : null}
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
        <nav className="nav-tabs five">
          {tabs.map((t) => (
            <Link
              key={t.href}
              href={t.href}
              className={
                pathname === t.href || (t.href !== '/' && pathname.startsWith(t.href))
                  ? 'active'
                  : undefined
              }
            >
              {t.label}
            </Link>
          ))}
        </nav>
      )}
    </div>
  );
}
