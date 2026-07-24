'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { Shell } from '@/components/Shell';
import { api } from '@/lib/api';
import { useAuth } from '@/lib/auth';
import { avatarGlyph, flag } from '@/lib/display';

type FullProfile = {
  user: {
    username: string;
    displayName: string;
    countryCode: string;
    level: number;
    xp: number;
    bio?: string | null;
    avatarUrl?: string | null;
  };
  xp: { level: number; into: number; need: number; ratio: number };
  wallet: { nexCoins: number };
  stats: {
    gameId: string;
    played: number;
    wins: number;
    losses: number;
    elo: number;
    winRate: number;
    winStreak: number;
    bestStreak: number;
  }[];
  totals: { played: number; wins: number; losses: number; winRate: number };
  badges: { name: string; description: string; code: string }[];
  history: {
    matchId: string;
    gameId: string;
    result: string | null;
    xpGained: number;
    coinsGained: number;
    finishedAt: string | null;
  }[];
  season: {
    name: string;
    code: string;
    standing: { points: number; wins: number; played: number } | null;
  } | null;
  clan: {
    name: string;
    tag: string;
    score: number;
    role: string;
    members: number;
    countryCode: string;
  } | null;
  avatarPresets: string[];
};

export default function ProfilePage() {
  const { session, loading, logout, refreshMe } = useAuth();
  const router = useRouter();
  const [me, setMe] = useState<FullProfile | null>(null);
  const [dailyMsg, setDailyMsg] = useState('');
  const [editing, setEditing] = useState(false);

  useEffect(() => {
    if (!loading && !session) router.replace('/auth');
  }, [loading, session, router]);

  async function load() {
    if (!session) return;
    const data = await api<FullProfile>('/auth/me', { token: session.accessToken });
    setMe(data);
  }

  useEffect(() => {
    void load();
  }, [session]);

  if (!session) return <Shell><p className="muted">…</p></Shell>;

  const u = me?.user ?? session.user;

  async function claimDaily() {
    try {
      const r = await api<{ ok: boolean; amount?: number; error?: string }>(
        '/api/wallet/daily',
        { method: 'POST', token: session!.accessToken, body: '{}' },
      );
      setDailyMsg(r.ok ? `+${r.amount} NexCoins` : 'Déjà réclamé aujourd’hui');
      await load();
    } catch {
      setDailyMsg('Déjà réclamé aujourd’hui');
    }
  }

  async function saveProfile(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const fd = new FormData(e.currentTarget);
    await api('/api/profile/me', {
      method: 'PATCH',
      token: session!.accessToken,
      body: JSON.stringify({
        displayName: String(fd.get('displayName')),
        bio: String(fd.get('bio') || ''),
        countryCode: String(fd.get('countryCode')),
        avatarUrl: `preset://${String(fd.get('avatar'))}`,
      }),
    });
    setEditing(false);
    await load();
    await refreshMe();
  }

  return (
    <Shell>
      <div className="profile-head">
        <div className="avatar">{avatarGlyph(u.avatarUrl, u.username)}</div>
        <div>
          <h1 style={{ margin: 0, fontFamily: 'var(--font-display)', fontSize: '1.6rem' }}>
            {u.displayName}
          </h1>
          <p className="muted" style={{ margin: '0.2rem 0' }}>
            {flag(u.countryCode)} @{u.username} · Nv.{me?.xp.level ?? u.level}
          </p>
          <div className="xp-bar" aria-label="Progression XP">
            <div style={{ width: `${(me?.xp.ratio ?? 0) * 100}%` }} />
          </div>
          <p className="muted" style={{ margin: '0.35rem 0 0', fontSize: '0.8rem' }}>
            {me?.xp.into ?? 0}/{me?.xp.need ?? 100} XP · {me?.wallet.nexCoins ?? 0} NexCoins
          </p>
        </div>
      </div>

      <div className="stack" style={{ marginBottom: '1rem' }}>
        <button className="btn btn-primary" onClick={claimDaily}>
          Récompense quotidienne
        </button>
        {dailyMsg ? <p className="muted">{dailyMsg}</p> : null}
        <button className="btn btn-secondary" onClick={() => setEditing((v) => !v)}>
          {editing ? 'Fermer' : 'Modifier le profil'}
        </button>
      </div>

      {editing ? (
        <form onSubmit={saveProfile} className="stack" style={{ marginBottom: '1.2rem' }}>
          <div className="field">
            <label htmlFor="displayName">Nom affiché</label>
            <input id="displayName" name="displayName" defaultValue={u.displayName} required />
          </div>
          <div className="field">
            <label htmlFor="bio">Bio</label>
            <input id="bio" name="bio" defaultValue={me?.user.bio ?? ''} maxLength={280} />
          </div>
          <div className="field">
            <label htmlFor="countryCode">Pays</label>
            <select id="countryCode" name="countryCode" defaultValue={u.countryCode}>
              {['BF', 'CI', 'SN', 'ML', 'FR', 'US'].map((c) => (
                <option key={c} value={c}>
                  {flag(c)} {c}
                </option>
              ))}
            </select>
          </div>
          <div className="field">
            <label htmlFor="avatar">Avatar</label>
            <select
              id="avatar"
              name="avatar"
              defaultValue={(u.avatarUrl ?? 'preset://lion').replace('preset://', '')}
            >
              {(me?.avatarPresets ?? ['lion', 'eagle', 'baobab']).map((p) => (
                <option key={p} value={p}>
                  {p}
                </option>
              ))}
            </select>
          </div>
          <button className="btn btn-primary" type="submit">
            Enregistrer
          </button>
        </form>
      ) : null}

      <div className="stat-grid">
        <div className="stat">
          <b>{me?.totals.played ?? 0}</b>
          <span>Parties</span>
        </div>
        <div className="stat">
          <b>{me?.totals.winRate ?? 0}%</b>
          <span>Winrate</span>
        </div>
        <div className="stat">
          <b>{me?.stats?.find((s) => s.gameId === 'ludo')?.elo ?? 1000}</b>
          <span>ELO Ludo</span>
        </div>
      </div>

      {me?.season ? (
        <>
          <p className="section-label">{me.season.name}</p>
          <p className="muted">
            {me.season.standing
              ? `${me.season.standing.points} pts · ${me.season.standing.wins}V / ${me.season.standing.played}P`
              : 'Pas encore de points cette saison — joue une partie ranked.'}
          </p>
        </>
      ) : null}

      {me?.clan ? (
        <>
          <p className="section-label">Clan</p>
          <div className="game-row">
            <div className="game-icon">[{me.clan.tag}]</div>
            <div className="game-meta">
              <strong>
                {flag(me.clan.countryCode)} {me.clan.name}
              </strong>
              <span>
                {me.clan.members} membres · score {me.clan.score} · {me.clan.role}
              </span>
            </div>
          </div>
        </>
      ) : null}

      <p className="section-label">Stats par jeu</p>
      {(me?.stats?.length ?? 0) === 0 ? (
        <p className="muted">Aucune partie terminée.</p>
      ) : (
        me!.stats.map((s) => (
          <div className="game-row" key={s.gameId}>
            <div className="game-icon">{s.gameId.slice(0, 2).toUpperCase()}</div>
            <div className="game-meta">
              <strong>{s.gameId}</strong>
              <span>
                {s.wins}V / {s.losses}D · {s.winRate}% · streak {s.winStreak} (best {s.bestStreak})
              </span>
            </div>
            <span className="pill">{s.elo}</span>
          </div>
        ))
      )}

      <p className="section-label">Historique</p>
      {(me?.history?.length ?? 0) === 0 ? (
        <p className="muted">Pas encore d’historique.</p>
      ) : (
        me!.history.map((h) => (
          <div className="game-row" key={h.matchId}>
            <div className="game-icon">{(h.result ?? '?').slice(0, 1).toUpperCase()}</div>
            <div className="game-meta">
              <strong>{h.gameId}</strong>
              <span>
                {h.result ?? '—'} · +{h.xpGained} XP · +{h.coinsGained} coins
              </span>
            </div>
          </div>
        ))
      )}

      <p className="section-label">Badges</p>
      {(me?.badges?.length ?? 0) === 0 ? (
        <p className="muted">Gagne une partie pour débloquer un badge.</p>
      ) : (
        me!.badges.map((b) => (
          <div className="game-row" key={b.code}>
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
        onClick={() => router.push('/settings')}
      >
        Langue & région / API
      </button>
      <button
        className="btn btn-secondary"
        style={{ marginTop: '0.7rem' }}
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
