'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { useEffect, useState } from 'react';
import { useAuth } from '@/lib/auth';
import { useNotifications } from '@/lib/notifications';
import { useI18n } from '@/i18n/provider';
import { useConnection } from '@/lib/connection';
import { api } from '@/lib/api';
import { getSocket } from '@/lib/socket';

export function Shell({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();
  const { session } = useAuth();
  const { unread } = useNotifications();
  const { t, locale, setLocale } = useI18n();
  const { effectiveLow } = useConnection();
  const [online, setOnline] = useState<number | null>(null);
  const hideNav =
    pathname.startsWith('/match/') ||
    pathname.startsWith('/auth') ||
    pathname.startsWith('/admin');

  const tabs = [
    { href: '/', label: t('nav.lobby') },
    { href: '/play', label: t('nav.play') },
    { href: '/shop', label: t('nav.shop') },
    { href: '/compete', label: t('nav.compete') },
    { href: '/profile', label: t('nav.profile') },
  ];

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
        <div style={{ display: 'flex', alignItems: 'center', gap: 8, flexWrap: 'wrap', justifyContent: 'flex-end' }}>
          {online !== null ? (
            <span className="muted" style={{ fontSize: '0.75rem' }}>
              ● {online} {t('online')}
            </span>
          ) : null}
          {effectiveLow ? (
            <span className="pill" title="Mode faible connexion">
              Lite
            </span>
          ) : null}
          <select
            aria-label="Language"
            value={locale}
            onChange={(e) => setLocale(e.target.value as typeof locale)}
            style={{
              background: 'rgba(0,0,0,.25)',
              border: '1px solid rgba(243,235,224,.12)',
              borderRadius: 8,
              color: 'var(--cream)',
              fontSize: '0.75rem',
              padding: '0.25rem 0.35rem',
            }}
          >
            <option value="fr">FR</option>
            <option value="en">EN</option>
            <option value="ar">AR</option>
            <option value="pt">PT</option>
            <option value="es">ES</option>
          </select>
          {session ? (
            <>
              <Link href="/events" className="btn-ghost">
                {t('nav.events')}
              </Link>
              <Link href="/leaderboard" className="btn-ghost">
                {t('nav.rankings')}
              </Link>
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
          {tabs.map((tab) => (
            <Link
              key={tab.href}
              href={tab.href}
              className={
                pathname === tab.href || (tab.href !== '/' && pathname.startsWith(tab.href))
                  ? 'active'
                  : undefined
              }
            >
              {tab.label}
            </Link>
          ))}
        </nav>
      )}
    </div>
  );
}
