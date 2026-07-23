'use client';

import { useEffect, useState } from 'react';
import type { FormEvent } from 'react';
import { useRouter } from 'next/navigation';
import { Shell } from '@/components/Shell';
import { api } from '@/lib/api';
import { useAuth } from '@/lib/auth';
import { flag } from '@/lib/display';

type Season = { id: string; code: string; name: string; status: string; endsAt: string };
type Tournament = {
  id: string;
  name: string;
  gameId: string;
  gameKind: string;
  status: string;
  entryCount: number;
  maxEntries: number;
  countryCode?: string | null;
};
type ClanRow = {
  id: string;
  name: string;
  tag: string;
  countryCode: string;
  score: number;
  members: number;
  maxMembers: number;
};

export default function CompetePage() {
  const { session, loading } = useAuth();
  const router = useRouter();
  const [active, setActive] = useState<Season | null>(null);
  const [board, setBoard] = useState<
    { rank: number; points: number; username?: string; countryCode?: string; displayName?: string }[]
  >([]);
  const [tournaments, setTournaments] = useState<Tournament[]>([]);
  const [clans, setClans] = useState<ClanRow[]>([]);
  const [msg, setMsg] = useState('');

  useEffect(() => {
    if (!loading && !session) router.replace('/auth');
  }, [loading, session, router]);

  useEffect(() => {
    if (!session) return;
    (async () => {
      const s = await api<{ active: Season | null }>('/api/seasons');
      setActive(s.active);
      if (s.active) {
        const lb = await api<{ entries: typeof board }>(
          `/api/seasons/${s.active.id}/leaderboard`,
        );
        setBoard(lb.entries);
      }
      const t = await api<{ tournaments: Tournament[] }>('/api/tournaments');
      setTournaments(t.tournaments);
      const c = await api<{ clans: ClanRow[] }>('/api/clans');
      setClans(c.clans);
    })();
  }, [session]);

  async function createTournament(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    if (!session) return;
    const fd = new FormData(e.currentTarget);
    const res = await api<{ tournament: { id: string } }>('/api/tournaments', {
      method: 'POST',
      token: session.accessToken,
      body: JSON.stringify({
        name: String(fd.get('name')),
        gameId: String(fd.get('gameId') || 'ludo'),
        gameKind: String(fd.get('gameKind') || 'INTEGRATED'),
        maxEntries: Number(fd.get('maxEntries') || 32),
        countryCode: 'BF',
      }),
    });
    setMsg(`Tournoi créé`);
    router.push(`/compete/tournament/${res.tournament.id}`);
  }

  async function createClan(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    if (!session) return;
    const fd = new FormData(e.currentTarget);
    try {
      await api('/api/clans', {
        method: 'POST',
        token: session.accessToken,
        body: JSON.stringify({
          name: String(fd.get('clanName')),
          tag: String(fd.get('tag')),
          countryCode: String(fd.get('countryCode') || 'BF'),
          description: String(fd.get('desc') || ''),
        }),
      });
      setMsg('Clan créé');
      const c = await api<{ clans: ClanRow[] }>('/api/clans');
      setClans(c.clans);
    } catch (err) {
      setMsg((err as Error).message);
    }
  }

  async function joinClan(id: string) {
    if (!session) return;
    try {
      await api(`/api/clans/${id}/join`, {
        method: 'POST',
        token: session.accessToken,
        body: '{}',
      });
      setMsg('Clan rejoint');
    } catch (err) {
      setMsg((err as Error).message);
    }
  }

  if (!session) return <Shell><p className="muted">…</p></Shell>;

  return (
    <Shell>
      <h1 className="hero-title" style={{ fontSize: '1.9rem' }}>
        Compétition
      </h1>
      <p className="lede">
        Saisons, tournois (intégrés & e-sport externe) et clans — le socle avant les prochains jeux.
      </p>
      {msg ? <p className="muted">{msg}</p> : null}

      <p className="section-label">
        {active ? active.name : 'Aucune saison active'}
      </p>
      {active ? (
        <p className="muted" style={{ marginTop: 0 }}>
          {active.code} · fin {new Date(active.endsAt).toLocaleDateString('fr-FR')}
        </p>
      ) : null}
      {board.slice(0, 10).map((e) => (
        <div className="game-row" key={e.rank}>
          <div className="game-icon">#{e.rank}</div>
          <div className="game-meta">
            <strong>
              {flag(e.countryCode)} {e.displayName ?? e.username}
            </strong>
            <span>@{e.username}</span>
          </div>
          <span className="pill">{e.points} pts</span>
        </div>
      ))}

      <p className="section-label">Tournois</p>
      {tournaments.length === 0 ? (
        <p className="muted">Aucun tournoi — crée le premier.</p>
      ) : (
        tournaments.map((t) => (
          <a className="game-row" key={t.id} href={`/compete/tournament/${t.id}`}>
            <div className="game-icon">{t.gameKind === 'EXTERNAL' ? 'EX' : 'IN'}</div>
            <div className="game-meta">
              <strong>{t.name}</strong>
              <span>
                {t.gameId} · {t.status} · {t.entryCount}/{t.maxEntries}
              </span>
            </div>
            <span className="pill">{t.countryCode ?? '🌍'}</span>
          </a>
        ))
      )}

      <form onSubmit={createTournament} className="stack" style={{ marginTop: '0.8rem' }}>
        <div className="field">
          <label htmlFor="name">Nouveau tournoi</label>
          <input id="name" name="name" placeholder="Tournoi Ludo Ouaga" required />
        </div>
        <div className="field">
          <label htmlFor="gameId">Jeu</label>
          <select id="gameId" name="gameId" defaultValue="ludo">
            <option value="ludo">Ludo</option>
            <option value="cod-mobile">COD Mobile (externe)</option>
            <option value="free-fire">Free Fire (externe)</option>
            <option value="pubg">PUBG (externe)</option>
          </select>
        </div>
        <div className="field">
          <label htmlFor="gameKind">Type</label>
          <select id="gameKind" name="gameKind" defaultValue="INTEGRATED">
            <option value="INTEGRATED">Intégré NexPlay</option>
            <option value="EXTERNAL">E-sport externe</option>
          </select>
        </div>
        <div className="field">
          <label htmlFor="maxEntries">Places</label>
          <select id="maxEntries" name="maxEntries" defaultValue="16">
            <option value="8">8</option>
            <option value="16">16</option>
            <option value="32">32</option>
            <option value="64">64</option>
          </select>
        </div>
        <button className="btn btn-secondary" type="submit">
          Créer le tournoi
        </button>
      </form>

      <p className="section-label">Clans</p>
      {clans.map((c) => (
        <div className="game-row" key={c.id}>
          <div className="game-icon">[{c.tag}]</div>
          <div className="game-meta">
            <strong>
              {flag(c.countryCode)} {c.name}
            </strong>
            <span>
              {c.members}/{c.maxMembers} · score {c.score}
            </span>
          </div>
          <button
            className="btn btn-ghost"
            style={{ width: 'auto' }}
            onClick={() => joinClan(c.id)}
          >
            Rejoindre
          </button>
        </div>
      ))}

      <form onSubmit={createClan} className="stack" style={{ marginTop: '0.8rem' }}>
        <div className="field">
          <label htmlFor="clanName">Créer un clan</label>
          <input id="clanName" name="clanName" placeholder="Nexa Warriors" required />
        </div>
        <div className="field">
          <label htmlFor="tag">Tag</label>
          <input id="tag" name="tag" placeholder="NXA" maxLength={6} required />
        </div>
        <div className="field">
          <label htmlFor="countryCode">Pays</label>
          <select id="countryCode" name="countryCode" defaultValue="BF">
            <option value="BF">🇧🇫 Burkina Faso</option>
            <option value="CI">🇨🇮 Côte d’Ivoire</option>
            <option value="SN">🇸🇳 Sénégal</option>
          </select>
        </div>
        <div className="field">
          <label htmlFor="desc">Description</label>
          <input id="desc" name="desc" placeholder="Compétition & fair-play" />
        </div>
        <button className="btn btn-primary" type="submit">
          Fonder le clan
        </button>
      </form>
    </Shell>
  );
}
