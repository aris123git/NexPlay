'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { Shell } from '@/components/Shell';
import { api } from '@/lib/api';
import { useAuth } from '@/lib/auth';

export default function ProfilePage() {
  const { session, loading, logout } = useAuth();
  const router = useRouter();
  const [me, setMe] = useState<{
    user: {
      username: string;
      displayName: string;
      countryCode: string;
      level: number;
      xp: number;
    };
    stats: { gameId: string; played: number; wins: number; losses: number; elo: number }[];
    badges: { name: string; description: string }[];
  } | null>(null);

  useEffect(() => {
    if (!loading && !session) router.replace('/auth');
  }, [loading, session, router]);

  useEffect(() => {
    if (!session) return;
    api<typeof me extends infer T ? NonNullable<T> : never>('/auth/me', {
      token: session.accessToken,
    }).then(setMe);
  }, [session]);

  if (!session) return <Shell><p className="muted">…</p></Shell>;

  const u = me?.user ?? session.user;

  return (
    <Shell>
      <div className="profile-head">
        <div className="avatar">{u.username.slice(0, 1).toUpperCase()}</div>
        <div>
          <h1 style={{ margin: 0, fontFamily: 'var(--font-display)', fontSize: '1.6rem' }}>
            {u.displayName}
          </h1>
          <p className="muted" style={{ margin: '0.2rem 0' }}>
            @{u.username} · {u.countryCode} · Nv.{u.level}
          </p>
          <p className="muted" style={{ margin: 0, fontSize: '0.85rem' }}>
            {u.xp} XP
          </p>
        </div>
      </div>

      <div className="stat-grid">
        <div className="stat">
          <b>{me?.stats?.reduce((a, s) => a + s.played, 0) ?? 0}</b>
          <span>Parties</span>
        </div>
        <div className="stat">
          <b>{me?.stats?.reduce((a, s) => a + s.wins, 0) ?? 0}</b>
          <span>Victoires</span>
        </div>
        <div className="stat">
          <b>{me?.stats?.find((s) => s.gameId === 'ludo')?.elo ?? 1000}</b>
          <span>ELO Ludo</span>
        </div>
      </div>

      <p className="section-label">Stats par jeu</p>
      {(me?.stats?.length ?? 0) === 0 ? (
        <p className="muted">Aucune partie terminée pour l’instant.</p>
      ) : (
        me!.stats.map((s) => (
          <div className="game-row" key={s.gameId}>
            <div className="game-icon">{s.gameId.slice(0, 2).toUpperCase()}</div>
            <div className="game-meta">
              <strong>{s.gameId}</strong>
              <span>
                {s.wins}V / {s.losses}D · {s.played} parties
              </span>
            </div>
            <span className="pill">{s.elo}</span>
          </div>
        ))
      )}

      <p className="section-label">Badges</p>
      {(me?.badges?.length ?? 0) === 0 ? (
        <p className="muted">Gagnez une partie pour débloquer votre premier badge.</p>
      ) : (
        me!.badges.map((b) => (
          <div className="game-row" key={b.name}>
            <div className="game-icon">★</div>
            <div className="game-meta">
              <strong>{b.name}</strong>
              <span>{b.description}</span>
            </div>
          </div>
        ))
      )}

      <button
        className="btn btn-secondary"
        style={{ marginTop: '1.5rem' }}
        onClick={() => {
          logout();
          router.push('/');
        }}
      >
        Déconnexion
      </button>
    </Shell>
  );
}
