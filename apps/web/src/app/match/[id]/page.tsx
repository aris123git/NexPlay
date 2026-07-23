'use client';

import { useEffect, useMemo, useState } from 'react';
import { useParams, useRouter } from 'next/navigation';
import { Shell } from '@/components/Shell';
import { LudoBoard } from '@/games/ludo/LudoBoard';
import { api } from '@/lib/api';
import { useAuth } from '@/lib/auth';
import { getSocket } from '@/lib/socket';

type MatchPayload = {
  id: string;
  status: string;
  gameId: string;
  state: LudoPublicState | null;
  players: {
    userId: string;
    seat: number;
    user: { profile: { username: string; displayName: string } | null };
  }[];
};

type LudoPublicState = {
  currentSeat: number;
  pendingDice: { value: number } | null;
  players: {
    playerId: string;
    seat: number;
    color: 'red' | 'green' | 'yellow' | 'blue';
    tokens: { kind: string; index?: number; slot?: number }[];
  }[];
  status: string;
  finishedOrder: string[];
  turnNumber: number;
};

export default function MatchPage() {
  const { id } = useParams<{ id: string }>();
  const { session, loading } = useAuth();
  const router = useRouter();
  const [match, setMatch] = useState<MatchPayload | null>(null);
  const [error, setError] = useState('');
  const [chat, setChat] = useState<{ username: string; text: string }[]>([]);
  const [msg, setMsg] = useState('');
  const [diceAnim, setDiceAnim] = useState(false);

  useEffect(() => {
    if (!loading && !session) router.replace('/auth');
  }, [loading, session, router]);

  useEffect(() => {
    if (!session || !id) return;
    let alive = true;

    (async () => {
      try {
        const data = await api<MatchPayload>(`/api/matches/${id}`, {
          token: session.accessToken,
        });
        if (alive) setMatch(data);
      } catch (e) {
        setError((e as Error).message);
      }
    })();

    const socket = getSocket(session.accessToken);
    socket.emit('match:join', { matchId: id }, (ack: { ok: boolean; match?: MatchPayload }) => {
      if (ack?.ok && ack.match) setMatch(ack.match as MatchPayload);
    });

    const onUpdate = (payload: {
      state: LudoPublicState;
      events: { type: string }[];
      finished?: boolean;
    }) => {
      setMatch((m) => (m ? { ...m, state: payload.state, status: payload.finished ? 'finished' : m.status } : m));
      if (payload.events?.some((e) => e.type === 'dice')) {
        setDiceAnim(true);
        setTimeout(() => setDiceAnim(false), 400);
      }
    };
    const onChat = (p: { username: string; text: string }) => {
      setChat((c) => [...c.slice(-30), p]);
    };

    socket.on('match:update', onUpdate);
    socket.on('chat:match', onChat);
    socket.on('match:ready', () => {
      api<MatchPayload>(`/api/matches/${id}`, { token: session.accessToken }).then(setMatch);
    });

    const poll = setInterval(() => {
      api<MatchPayload>(`/api/matches/${id}`, { token: session.accessToken })
        .then((d) => alive && setMatch(d))
        .catch(() => undefined);
    }, 3000);

    return () => {
      alive = false;
      socket.off('match:update', onUpdate);
      socket.off('chat:match', onChat);
      clearInterval(poll);
    };
  }, [session, id]);

  const meSeat = useMemo(() => {
    if (!match || !session) return -1;
    return match.players.find((p) => p.userId === session.user.id)?.seat ?? -1;
  }, [match, session]);

  const isMyTurn = match?.state?.currentSeat === meSeat && match.status === 'active';

  async function sendAction(action: { type: string; tokenIndex?: number }) {
    if (!session) return;
    const socket = getSocket(session.accessToken);
    socket.emit(
      'match:action',
      { matchId: id, action },
      (ack: { ok: boolean; message?: string; state?: LudoPublicState; finished?: boolean }) => {
        if (!ack?.ok) {
          setError(ack?.message ?? 'Action refusée');
          return;
        }
        setError('');
        if (ack.state) {
          setMatch((m) =>
            m
              ? {
                  ...m,
                  state: ack.state!,
                  status: ack.finished ? 'finished' : m.status,
                }
              : m,
          );
        }
      },
    );
  }

  function sendChat() {
    if (!session || !msg.trim()) return;
    getSocket(session.accessToken).emit('chat:match', { matchId: id, text: msg.trim() });
    setMsg('');
  }

  if (!session || !match) {
    return (
      <Shell>
        <p className="muted">{error || 'Chargement de la partie…'}</p>
      </Shell>
    );
  }

  const state = match.state;

  return (
    <Shell>
      <div className="hud">
        <div>
          <div className="section-label" style={{ margin: 0 }}>
            {match.status === 'waiting' ? 'En attente de joueurs' : 'Partie Ludo'}
          </div>
          <strong>
            {state
              ? `Tour ${state.turnNumber} · ${
                  match.players[state.currentSeat]?.user.profile?.username ?? '…'
                }`
              : `${match.players.length} joueur(s)`}
          </strong>
        </div>
        <div className={`dice ${diceAnim ? 'spin' : ''}`}>
          {state?.pendingDice?.value ?? '·'}
        </div>
      </div>

      {match.status === 'waiting' ? (
        <p className="lede waiting" style={{ padding: '1rem 0' }}>
          Partagez le code d’invitation. La partie démarre automatiquement.
        </p>
      ) : null}

      {state ? (
        <LudoBoard
          state={state}
          myPlayerId={session.user.id}
          onSelectToken={(tokenIndex) => sendAction({ type: 'move', tokenIndex })}
        />
      ) : null}

      <div className="stack" style={{ marginTop: '1rem' }}>
        {isMyTurn && !state?.pendingDice ? (
          <button className="btn btn-primary" onClick={() => sendAction({ type: 'roll' })}>
            Lancer le dé
          </button>
        ) : null}
        {isMyTurn && state?.pendingDice ? (
          <p className="muted">Sélectionnez un pion mis en évidence, ou passez s’il n’y a pas de coup.</p>
        ) : null}
        {isMyTurn && state?.pendingDice ? (
          <button className="btn btn-secondary" onClick={() => sendAction({ type: 'pass' })}>
            Passer (aucun coup)
          </button>
        ) : null}
        {match.status === 'finished' ? (
          <p className="lede">
            Partie terminée — vainqueur :{' '}
            {match.players.find((p) => p.userId === state?.finishedOrder?.[0])?.user.profile
              ?.username ?? '—'}
          </p>
        ) : null}
        {error ? <p className="error">{error}</p> : null}
      </div>

      <p className="section-label">Joueurs</p>
      {match.players.map((p) => (
        <div className="game-row" key={p.userId}>
          <div className={`game-icon`}>{['R', 'V', 'J', 'B'][p.seat]}</div>
          <div className="game-meta">
            <strong>{p.user.profile?.displayName ?? p.userId}</strong>
            <span>@{p.user.profile?.username}</span>
          </div>
        </div>
      ))}

      <p className="section-label">Chat</p>
      <div style={{ maxHeight: 120, overflow: 'auto', marginBottom: 8 }}>
        {chat.map((c, i) => (
          <p className="chat-line" key={i}>
            <b>{c.username}</b> {c.text}
          </p>
        ))}
      </div>
      <div style={{ display: 'flex', gap: 8 }}>
        <input
          value={msg}
          onChange={(e) => setMsg(e.target.value)}
          placeholder="Message…"
          style={{
            flex: 1,
            background: 'rgba(0,0,0,.28)',
            border: '1px solid rgba(243,235,224,.12)',
            borderRadius: 12,
            padding: '0.75rem',
            color: 'var(--cream)',
          }}
        />
        <button className="btn btn-secondary" style={{ width: 'auto' }} onClick={sendChat}>
          OK
        </button>
      </div>
    </Shell>
  );
}
