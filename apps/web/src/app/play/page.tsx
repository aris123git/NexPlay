'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { Shell } from '@/components/Shell';
import { api } from '@/lib/api';
import { useAuth } from '@/lib/auth';

export default function PlayPage() {
  const { session, loading } = useAuth();
  const router = useRouter();
  const [playerCount, setPlayerCount] = useState(2);
  const [status, setStatus] = useState('');
  const [inviteCode, setInviteCode] = useState('');
  const [joinCode, setJoinCode] = useState('');
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    if (!loading && !session) router.replace('/auth');
  }, [loading, session, router]);

  if (!session) return <Shell><p className="muted">Chargement…</p></Shell>;

  async function queuePublic() {
    setBusy(true);
    setStatus('Recherche d’adversaires…');
    try {
      const mode = `public-${playerCount}`;
      const res = await api<{
        status: string;
        match?: { id: string };
      }>('/api/matchmaking/queue', {
        method: 'POST',
        token: session!.accessToken,
        body: JSON.stringify({
          gameId: 'ludo',
          mode,
          playerCount,
          region: 'bf-ouaga',
        }),
      });
      if (res.status === 'matched' && res.match) {
        router.push(`/match/${res.match.id}`);
        return;
      }
      setStatus('En file d’attente — relancez quand un ami s’inscrit, ou créez une partie privée.');
      // Simple poll: try again shortly for demo with 2 accounts
      const poll = setInterval(async () => {
        try {
          const again = await api<{ status: string; match?: { id: string } }>(
            '/api/matchmaking/queue',
            {
              method: 'POST',
              token: session!.accessToken,
              body: JSON.stringify({
                gameId: 'ludo',
                mode,
                playerCount,
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
            gameId: 'ludo',
            mode: `private-${playerCount}`,
            playerCount,
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
        Ludo
      </h1>
      <p className="lede">
        Matchmaking public ou partie privée entre amis. 2, 3 ou 4 joueurs.
      </p>

      <div className="field">
        <label htmlFor="pc">Nombre de joueurs</label>
        <select
          id="pc"
          value={playerCount}
          onChange={(e) => setPlayerCount(Number(e.target.value))}
        >
          <option value={2}>2 joueurs</option>
          <option value={3}>3 joueurs</option>
          <option value={4}>4 joueurs</option>
        </select>
      </div>

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
      <button className="btn btn-secondary" disabled={busy || joinCode.length < 4} onClick={joinPrivate}>
        Rejoindre
      </button>

      {status ? <p className="muted" style={{ marginTop: '1rem' }}>{status}</p> : null}
    </Shell>
  );
}
