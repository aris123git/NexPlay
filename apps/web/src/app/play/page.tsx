'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { Shell } from '@/components/Shell';
import { api } from '@/lib/api';
import { useAuth } from '@/lib/auth';

const GAMES = [
  {
    id: 'ludo',
    name: 'Ludo',
    blurb: '2 à 4 joueurs · dés sécurisés',
    counts: [2, 3, 4],
  },
  {
    id: 'dames',
    name: 'Dames',
    blurb: '1v1 · plateau 8×8 · ELO',
    counts: [2],
  },
] as const;

export default function PlayPage() {
  const { session, loading } = useAuth();
  const router = useRouter();
  const [gameId, setGameId] = useState<(typeof GAMES)[number]['id']>('ludo');
  const [playerCount, setPlayerCount] = useState(2);
  const [status, setStatus] = useState('');
  const [inviteCode, setInviteCode] = useState('');
  const [joinCode, setJoinCode] = useState('');
  const [busy, setBusy] = useState(false);

  const game = GAMES.find((g) => g.id === gameId)!;

  useEffect(() => {
    if (!loading && !session) router.replace('/auth');
  }, [loading, session, router]);

  useEffect(() => {
    if (!(game.counts as readonly number[]).includes(playerCount)) {
      setPlayerCount(game.counts[0]!);
    }
  }, [gameId, game.counts, playerCount]);

  if (!session) {
    return (
      <Shell>
        <p className="muted">Chargement…</p>
      </Shell>
    );
  }

  async function queuePublic() {
    setBusy(true);
    setStatus('Recherche d’adversaires…');
    try {
      const mode = gameId === 'dames' ? 'public-2' : `public-${playerCount}`;
      const res = await api<{
        status: string;
        match?: { id: string };
      }>('/api/matchmaking/queue', {
        method: 'POST',
        token: session!.accessToken,
        body: JSON.stringify({
          gameId,
          mode,
          playerCount: gameId === 'dames' ? 2 : playerCount,
          region: 'bf-ouaga',
        }),
      });
      if (res.status === 'matched' && res.match) {
        router.push(`/match/${res.match.id}`);
        return;
      }
      setStatus('En file d’attente — un second joueur doit rejoindre la même file.');
      const poll = setInterval(async () => {
        try {
          const again = await api<{ status: string; match?: { id: string } }>(
            '/api/matchmaking/queue',
            {
              method: 'POST',
              token: session!.accessToken,
              body: JSON.stringify({
                gameId,
                mode,
                playerCount: gameId === 'dames' ? 2 : playerCount,
                region: 'bf-ouaga',
              }),
            },
          );
          if (again.status === 'matched' && again.match) {
            clearInterval(poll);
            router.push(`/match/${again.match.id}`);
          }
        } catch {
          /* ignore */
        }
      }, 2000);
      setTimeout(() => clearInterval(poll), 60000);
    } catch (e) {
      setStatus((e as Error).message);
    } finally {
      setBusy(false);
    }
  }

  async function createPrivate() {
    setBusy(true);
    try {
      const res = await api<{ matchId: string; inviteCode: string }>(
        '/api/matches/private',
        {
          method: 'POST',
          token: session!.accessToken,
          body: JSON.stringify({
            gameId,
            mode: gameId === 'dames' ? 'private-2' : `private-${playerCount}`,
            playerCount: gameId === 'dames' ? 2 : playerCount,
          }),
        },
      );
      setInviteCode(res.inviteCode);
      setStatus(`Partie privée créée. Code : ${res.inviteCode}`);
      router.push(`/match/${res.matchId}`);
    } catch (e) {
      setStatus((e as Error).message);
    } finally {
      setBusy(false);
    }
  }

  async function joinPrivate() {
    setBusy(true);
    try {
      const res = await api<{ id: string }>(`/api/matches/join/${joinCode.trim()}`, {
        method: 'POST',
        token: session!.accessToken,
      });
      router.push(`/match/${res.id}`);
    } catch (e) {
      setStatus((e as Error).message);
    } finally {
      setBusy(false);
    }
  }

  return (
    <Shell>
      <h1 className="hero-title" style={{ fontSize: '2rem' }}>
        Jouer
      </h1>
      <p className="lede">Choisissez un jeu, puis une partie publique ou privée.</p>

      <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', marginBottom: 12 }}>
        {GAMES.map((g) => (
          <button
            key={g.id}
            type="button"
            className={`btn ${gameId === g.id ? 'btn-primary' : 'btn-ghost'}`}
            style={{ width: 'auto', padding: '0.45rem 0.85rem' }}
            onClick={() => setGameId(g.id)}
          >
            {g.name}
          </button>
        ))}
      </div>
      <p className="muted">{game.blurb}</p>

      {game.counts.length > 1 ? (
        <div className="field">
          <label htmlFor="pc">Nombre de joueurs</label>
          <select
            id="pc"
            value={playerCount}
            onChange={(e) => setPlayerCount(Number(e.target.value))}
          >
            {game.counts.map((n) => (
              <option key={n} value={n}>
                {n} joueurs
              </option>
            ))}
          </select>
        </div>
      ) : null}

      <div className="stack">
        <button className="btn btn-primary waiting" disabled={busy} onClick={queuePublic}>
          Partie publique
        </button>
        <button className="btn btn-secondary" disabled={busy} onClick={createPrivate}>
          Créer une partie privée
        </button>
      </div>

      {inviteCode ? (
        <p className="lede" style={{ marginTop: '1rem' }}>
          Code invitation : <strong>{inviteCode}</strong>
        </p>
      ) : null}

      <p className="section-label">Rejoindre</p>
      <div className="field">
        <label htmlFor="code">Code d’invitation</label>
        <input
          id="code"
          value={joinCode}
          onChange={(e) => setJoinCode(e.target.value.toUpperCase())}
          placeholder="ABC123"
          maxLength={6}
        />
      </div>
      <button
        className="btn btn-secondary"
        disabled={busy || joinCode.length < 4}
        onClick={joinPrivate}
      >
        Rejoindre
      </button>

      {status ? (
        <p className="muted" style={{ marginTop: '1rem' }}>
          {status}
        </p>
      ) : null}
    </Shell>
  );
}
