'use client';

import { useEffect } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { Shell } from '@/components/Shell';
import { useAuth } from '@/lib/auth';
import { useNotifications } from '@/lib/notifications';
import { api } from '@/lib/api';

export default function NotificationsPage() {
  const { session, loading } = useAuth();
  const router = useRouter();
  const { items, unread, markAllRead } = useNotifications();

  useEffect(() => {
    if (!loading && !session) router.replace('/auth');
  }, [loading, session, router]);

  useEffect(() => {
    if (session && unread > 0) void markAllRead();
  }, [session]);

  async function respondInvite(inviteId: string, accept: boolean) {
    if (!session) return;
    const res = await api<{ status: string; match?: { id: string } }>(
      `/api/invites/${inviteId}/respond`,
      {
        method: 'POST',
        token: session.accessToken,
        body: JSON.stringify({ accept }),
      },
    );
    if (accept && res.match?.id) router.push(`/match/${res.match.id}`);
  }

  return (
    <Shell>
      <h1 className="hero-title" style={{ fontSize: '1.8rem' }}>
        Notifications
      </h1>
      <p className="lede">Invitations, résultats, tournois et saison.</p>

      {items.length === 0 ? (
        <p className="muted">Aucune notification pour l’instant.</p>
      ) : (
        items.map((n) => (
          <div className="game-row" key={n.id} style={{ alignItems: 'flex-start' }}>
            <div className="game-icon">{n.type.slice(0, 2).toUpperCase()}</div>
            <div className="game-meta">
              <strong>{n.title}</strong>
              <span>{n.body}</span>
              {n.type === 'match_invite' && n.data?.inviteId ? (
                <div style={{ display: 'flex', gap: 8, marginTop: 8 }}>
                  <button
                    className="btn btn-primary"
                    style={{ width: 'auto', padding: '0.45rem 0.9rem' }}
                    onClick={() => respondInvite(String(n.data.inviteId), true)}
                  >
                    Accepter
                  </button>
                  <button
                    className="btn btn-secondary"
                    style={{ width: 'auto', padding: '0.45rem 0.9rem' }}
                    onClick={() => respondInvite(String(n.data.inviteId), false)}
                  >
                    Refuser
                  </button>
                </div>
              ) : null}
              {n.data?.matchId && n.type === 'match_result' ? (
                <Link
                  href={`/match/${String(n.data.matchId)}`}
                  className="muted"
                  style={{ display: 'inline-block', marginTop: 6, fontSize: '0.8rem' }}
                >
                  Voir la partie →
                </Link>
              ) : null}
            </div>
          </div>
        ))
      )}
    </Shell>
  );
}
