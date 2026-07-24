'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { Shell } from '@/components/Shell';
import { api } from '@/lib/api';
import { useAuth } from '@/lib/auth';

type ReplayListItem = {
  id: string;
  matchId: string;
  gameId: string;
  shareCode: string;
  views: number;
  durationMs: number | null;
  createdAt: string;
};

type ReplayDetail = {
  shareCode: string;
  gameId: string;
  durationMs: number | null;
  views: number;
  meta: {
    players: { username?: string; result?: string | null; seat: number }[];
    moveCount: number;
    winners: string[];
  };
  moves: { seq: number; playerId: string; action: unknown }[];
  players: { username?: string; seat: number; result?: string | null }[];
  matchId: string;
};

export default function ReplaysPage() {
  const { session, loading } = useAuth();
  const router = useRouter();
  const [list, setList] = useState<ReplayListItem[]>([]);
  const [code, setCode] = useState('');
  const [detail, setDetail] = useState<ReplayDetail | null>(null);
  const [msg, setMsg] = useState('');

  useEffect(() => {
    if (!loading && !session) router.replace('/auth');
  }, [loading, session, router]);

  useEffect(() => {
    if (!session) return;
    api<{ replays: ReplayListItem[] }>('/api/replays/me', { token: session.accessToken }).then(
      (d) => setList(d.replays),
    );
  }, [session]);

  async function openCode(c: string) {
    try {
      const data = await api<{ replay: ReplayDetail }>(`/api/replays/${c.toUpperCase()}`);
      setDetail(data.replay);
      setCode(c.toUpperCase());
      setMsg('');
    } catch {
      setMsg('Replay introuvable');
      setDetail(null);
    }
  }

  async function reportCheat() {
    if (!session || !detail) return;
    await api('/api/replays/report-cheat', {
      method: 'POST',
      token: session.accessToken,
      body: JSON.stringify({ matchId: detail.matchId, reason: 'suspicious_play' }),
    });
    setMsg('Signalement envoyé aux modérateurs');
  }

  if (!session) {
    return (
      <Shell>
        <p className="muted">…</p>
      </Shell>
    );
  }

  return (
    <Shell>
      <h1 className="hero-title" style={{ fontSize: '1.8rem' }}>
        Replays
      </h1>
      <p className="lede">Revois, partage, analyse — et signale une triche si besoin.</p>

      <div className="field">
        <label htmlFor="code">Code de partage</label>
        <input
          id="code"
          value={code}
          onChange={(e) => setCode(e.target.value.toUpperCase())}
          placeholder="ABCD1234"
        />
      </div>
      <button className="btn btn-primary" onClick={() => openCode(code)}>
        Ouvrir
      </button>
      {msg ? <p className="muted">{msg}</p> : null}

      {detail ? (
        <>
          <p className="section-label">
            {detail.gameId} · {detail.shareCode} · {detail.views} vues
          </p>
          <p className="muted">
            Durée {detail.durationMs ? `${Math.round(detail.durationMs / 1000)}s` : '—'} ·{' '}
            {detail.meta.moveCount} coups
          </p>
          {detail.players.map((p) => (
            <div className="game-row" key={p.seat}>
              <div className="game-icon">{p.seat + 1}</div>
              <div className="game-meta">
                <strong>{p.username}</strong>
                <span>{p.result ?? '—'}</span>
              </div>
            </div>
          ))}
          <p className="section-label">Coups</p>
          <div style={{ maxHeight: 220, overflow: 'auto' }}>
            {detail.moves.map((m) => (
              <p className="chat-line" key={m.seq}>
                #{m.seq} {JSON.stringify(m.action)}
              </p>
            ))}
          </div>
          <button className="btn btn-secondary" style={{ marginTop: 12 }} onClick={reportCheat}>
            Signaler une triche
          </button>
        </>
      ) : null}

      <p className="section-label">Mes parties</p>
      {list.length === 0 ? (
        <p className="muted">Termine une partie pour générer un replay automatique.</p>
      ) : (
        list.map((r) => (
          <button
            key={r.id}
            type="button"
            className="game-row"
            style={{
              width: '100%',
              background: 'transparent',
              border: 0,
              color: 'inherit',
              textAlign: 'left',
            }}
            onClick={() => openCode(r.shareCode)}
          >
            <div className="game-icon">{r.gameId.slice(0, 2).toUpperCase()}</div>
            <div className="game-meta">
              <strong>{r.shareCode}</strong>
              <span>
                {r.views} vues · {r.durationMs ? `${Math.round(r.durationMs / 1000)}s` : '—'}
              </span>
            </div>
          </button>
        ))
      )}
    </Shell>
  );
}
