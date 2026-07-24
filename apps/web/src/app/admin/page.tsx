'use client';

import { useEffect, useState } from 'react';
import type { FormEvent } from 'react';
import { useRouter } from 'next/navigation';
import { Shell } from '@/components/Shell';
import { api } from '@/lib/api';
import { useAuth } from '@/lib/auth';
import { flag } from '@/lib/display';

export default function AdminPage() {
  const { session, loading } = useAuth();
  const router = useRouter();
  const [stats, setStats] = useState<Record<string, unknown> | null>(null);
  const [users, setUsers] = useState<
    {
      id: string;
      email: string;
      role: string;
      status: string;
      profile?: { username: string; countryCode: string; level: number } | null;
      wallet?: { nexCoins: number } | null;
    }[]
  >([]);
  const [reports, setReports] = useState<{ chat: unknown[]; cheat: { id: string; reason: string; matchId: string }[] }>({
    chat: [],
    cheat: [],
  });
  const [msg, setMsg] = useState('');
  const role = (session?.user as { role?: string } | undefined)?.role;

  useEffect(() => {
    if (!loading && !session) router.replace('/auth');
  }, [loading, session, router]);

  useEffect(() => {
    if (!session) return;
    if (role !== 'admin' && role !== 'moderator') {
      setMsg('Accès réservé au staff');
      return;
    }
    void refresh();
  }, [session, role]);

  async function refresh() {
    if (!session) return;
    const s = await api<Record<string, unknown>>('/api/admin/stats', {
      token: session.accessToken,
    });
    setStats(s);
    const u = await api<{ users: typeof users }>('/api/admin/users', {
      token: session.accessToken,
    });
    setUsers(u.users);
    const r = await api<typeof reports>('/api/admin/reports', {
      token: session.accessToken,
    });
    setReports(r);
  }

  if (!session) return <Shell><p className="muted">…</p></Shell>;
  if (role !== 'admin' && role !== 'moderator') {
    return (
      <Shell>
        <h1 className="hero-title" style={{ fontSize: '1.6rem' }}>
          Admin
        </h1>
        <p className="error">{msg || 'Forbidden'}</p>
      </Shell>
    );
  }

  const dash = (stats?.dashboard ?? {}) as {
    onlineCount?: number;
    usersTotal?: number;
    matchesToday?: number;
    avgDurationSec?: number;
    topGames?: { gameId: string; count: number }[];
    topCountries?: { countryCode: string; players: number }[];
    retention?: { d1: number; d7: number; d30: number; cohortSize: number };
  };

  async function ban(id: string) {
    if (!session) return;
    await api(`/api/admin/users/${id}/ban`, {
      method: 'POST',
      token: session.accessToken,
      body: JSON.stringify({ reason: 'ToS violation' }),
    });
    setMsg('Utilisateur banni');
    await refresh();
  }

  async function grant(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    if (!session) return;
    const fd = new FormData(e.currentTarget);
    await api('/api/admin/rewards', {
      method: 'POST',
      token: session.accessToken,
      body: JSON.stringify({
        userId: String(fd.get('userId')),
        amount: Number(fd.get('amount')),
        reason: String(fd.get('reason')),
      }),
    });
    setMsg('Récompense attribuée');
  }

  async function createSeason(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    if (!session) return;
    const fd = new FormData(e.currentTarget);
    await api('/api/admin/seasons', {
      method: 'POST',
      token: session.accessToken,
      body: JSON.stringify({
        code: String(fd.get('code')),
        name: String(fd.get('name')),
        startsAt: String(fd.get('startsAt')),
        endsAt: String(fd.get('endsAt')),
        activate: true,
      }),
    });
    setMsg('Saison créée');
  }

  return (
    <Shell>
      <h1 className="hero-title" style={{ fontSize: '1.7rem' }}>
        Back-office
      </h1>
      <p className="lede">Modération, saisons, rewards, analytics globales.</p>
      {msg ? <p className="muted">{msg}</p> : null}

      <div className="stat-grid">
        <div className="stat">
          <b>{dash.onlineCount ?? 0}</b>
          <span>Online</span>
        </div>
        <div className="stat">
          <b>{dash.usersTotal ?? 0}</b>
          <span>Joueurs</span>
        </div>
        <div className="stat">
          <b>{dash.matchesToday ?? 0}</b>
          <span>Matchs J</span>
        </div>
      </div>

      <p className="section-label">Analytics</p>
      <p className="muted">
        Durée moy. {dash.avgDurationSec ?? 0}s · Rétention J1 {dash.retention?.d1 ?? 0}% / J7{' '}
        {dash.retention?.d7 ?? 0}% / J30 {dash.retention?.d30 ?? 0}% (n=
        {dash.retention?.cohortSize ?? 0})
      </p>
      {(dash.topGames ?? []).map((g) => (
        <div className="game-row" key={g.gameId}>
          <div className="game-icon">{g.gameId.slice(0, 2).toUpperCase()}</div>
          <div className="game-meta">
            <strong>{g.gameId}</strong>
            <span>{g.count} parties terminées</span>
          </div>
        </div>
      ))}
      {(dash.topCountries ?? []).slice(0, 5).map((c) => (
        <div className="game-row" key={c.countryCode}>
          <div className="game-icon">{flag(c.countryCode)}</div>
          <div className="game-meta">
            <strong>{c.countryCode}</strong>
            <span>{c.players} joueurs</span>
          </div>
        </div>
      ))}

      <p className="section-label">Utilisateurs</p>
      {users.slice(0, 20).map((u) => (
        <div className="game-row" key={u.id}>
          <div className="game-icon">{flag(u.profile?.countryCode)}</div>
          <div className="game-meta">
            <strong>
              @{u.profile?.username} · {u.role}
            </strong>
            <span>
              {u.email} · {u.status} · {u.wallet?.nexCoins ?? 0} coins
            </span>
          </div>
          {u.status === 'active' ? (
            <button className="btn btn-ghost" style={{ width: 'auto' }} onClick={() => ban(u.id)}>
              Ban
            </button>
          ) : null}
        </div>
      ))}

      {role === 'admin' ? (
        <>
          <p className="section-label">Attribuer NexCoins</p>
          <form onSubmit={grant} className="stack">
            <div className="field">
              <label htmlFor="userId">User ID</label>
              <input id="userId" name="userId" required />
            </div>
            <div className="field">
              <label htmlFor="amount">Montant</label>
              <input id="amount" name="amount" type="number" defaultValue={100} required />
            </div>
            <div className="field">
              <label htmlFor="reason">Raison</label>
              <input id="reason" name="reason" defaultValue="promo" required />
            </div>
            <button className="btn btn-secondary" type="submit">
              Créditer
            </button>
          </form>

          <p className="section-label">Nouvelle saison</p>
          <form onSubmit={createSeason} className="stack">
            <div className="field">
              <label htmlFor="code">Code</label>
              <input id="code" name="code" placeholder="S3-2026" required />
            </div>
            <div className="field">
              <label htmlFor="name">Nom</label>
              <input id="name" name="name" placeholder="Saison 3" required />
            </div>
            <div className="field">
              <label htmlFor="startsAt">Début (ISO)</label>
              <input id="startsAt" name="startsAt" defaultValue="2026-10-01T00:00:00.000Z" required />
            </div>
            <div className="field">
              <label htmlFor="endsAt">Fin (ISO)</label>
              <input id="endsAt" name="endsAt" defaultValue="2026-12-31T23:59:59.000Z" required />
            </div>
            <button className="btn btn-primary" type="submit">
              Activer la saison
            </button>
          </form>
        </>
      ) : null}

      <p className="section-label">Signalements triche</p>
      {reports.cheat.length === 0 ? (
        <p className="muted">Aucun</p>
      ) : (
        reports.cheat.map((c) => (
          <div className="game-row" key={c.id}>
            <div className="game-icon">!</div>
            <div className="game-meta">
              <strong>{c.reason}</strong>
              <span>{c.matchId}</span>
            </div>
          </div>
        ))
      )}
    </Shell>
  );
}
