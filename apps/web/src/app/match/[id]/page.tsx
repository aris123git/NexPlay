'use client';

import { useEffect, useMemo, useState } from 'react';
import { useParams, useRouter } from 'next/navigation';
import { Shell } from '@/components/Shell';
import { LudoBoard } from '@/games/ludo/LudoBoard';
import { DamesBoard } from '@/games/dames/DamesBoard';
import { api } from '@/lib/api';
import { useAuth } from '@/lib/auth';
import { getSocket } from '@/lib/socket';

type MatchPayload = {
  id: string;
  status: string;
  gameId: string;
  state: Record<string, unknown> | null;
  players: {
    userId: string;
    seat: number;
    user: {
      profile: {
        username: string;
        displayName: string;
        nexplayId?: string;
      } | null;
    };
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

type DamesPublicState = {
  board: ({ side: 'dark' | 'light'; king: boolean } | null)[];
  currentSide: 'dark' | 'light';
  sides: { dark: string; light: string };
  continueFrom: number | null;
  status: string;
  turnNumber: number;
  winnerId: string | null;
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
  const [damesSelected, setDamesSelected] = useState<number | null>(null);
  const [damesLegal, setDamesLegal] = useState<{ from: number; to: number }[]>([]);

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
      if (ack?.ok && ack.match) setMatch(ack.match);
    });

    const onUpdate = (payload: {
      state: Record<string, unknown>;
      events: { type: string }[];
      finished?: boolean;
    }) => {
      setMatch((m) =>
        m ? { ...m, state: payload.state, status: payload.finished ? 'finished' : m.status } : m,
      );
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

  const ludoState = match?.gameId === 'ludo' ? (match.state as LudoPublicState | null) : null;
  const damesState = match?.gameId === 'dames' ? (match.state as DamesPublicState | null) : null;

  const isMyTurnLudo =
    !!ludoState && ludoState.currentSeat === meSeat && match?.status === 'active';

  // Refresh legal moves for dames via lightweight client mirror of current turn pieces
  useEffect(() => {
    if (!damesState || !session || match?.status !== 'active') {
      setDamesLegal([]);
      return;
    }
    // Ask server by probing — use getLegal from state heuristically via empty action ack is overkill;
    // compute from exposed state: we request legal via a dedicated field if present, else fetch match moves hint.
    // Client-side: mark all own pieces as selectable sources; server validates.
    const mySide =
      damesState.sides.dark === session.user.id
        ? 'dark'
        : damesState.sides.light === session.user.id
          ? 'light'
          : null;
    if (!mySide || damesState.currentSide !== mySide) {
      setDamesLegal([]);
      setDamesSelected(null);
      return;
    }
    // Build candidate moves locally (same rules as engine subset)
    const legal = computeClientLegal(damesState, mySide);
    setDamesLegal(legal);
  }, [damesState, session, match?.status]);

  function sendAction(action: Record<string, unknown>) {
    if (!session) return;
    const socket = getSocket(session.accessToken);
    socket.emit(
      'match:action',
      { matchId: id, action },
      (ack: {
        ok: boolean;
        message?: string;
        state?: Record<string, unknown>;
        finished?: boolean;
      }) => {
        if (!ack?.ok) {
          setError(ack?.message ?? 'Action refusée');
          return;
        }
        setError('');
        setDamesSelected(null);
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

  function onDamesSquare(i: number) {
    if (!damesState || !session) return;
    if (damesSelected !== null) {
      const hit = damesLegal.find((m) => m.from === damesSelected && m.to === i);
      if (hit) {
        sendAction({ type: 'move', from: hit.from, to: hit.to });
        return;
      }
    }
    if (damesLegal.some((m) => m.from === i)) {
      setDamesSelected(i);
      return;
    }
    setDamesSelected(null);
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

  const gameTitle = match.gameId === 'dames' ? 'Dames' : 'Ludo';

  return (
    <Shell>
      <div className="hud">
        <div>
          <div className="section-label" style={{ margin: 0 }}>
            {match.status === 'waiting' ? 'En attente de joueurs' : `Partie ${gameTitle}`}
          </div>
          <strong>
            {ludoState
              ? `Tour ${ludoState.turnNumber} · ${
                  match.players[ludoState.currentSeat]?.user.profile?.username ?? '…'
                }`
              : damesState
                ? `Tour ${damesState.turnNumber} · ${
                    damesState.currentSide === 'dark' ? 'Noirs' : 'Blancs'
                  }`
                : `${match.players.length} joueur(s)`}
          </strong>
        </div>
        {match.gameId === 'ludo' ? (
          <div className={`dice ${diceAnim ? 'spin' : ''}`}>
            {ludoState?.pendingDice?.value ?? '·'}
          </div>
        ) : (
          <div className="dice">♛</div>
        )}
      </div>

      {match.status === 'waiting' ? (
        <p className="lede waiting" style={{ padding: '1rem 0' }}>
          Partagez le code d’invitation. La partie démarre automatiquement.
        </p>
      ) : null}

      {ludoState ? (
        <LudoBoard
          state={ludoState}
          myPlayerId={session.user.id}
          onSelectToken={(tokenIndex) => sendAction({ type: 'move', tokenIndex })}
        />
      ) : null}

      {damesState ? (
        <DamesBoard
          state={damesState}
          myPlayerId={session.user.id}
          legalMoves={damesLegal}
          selected={damesSelected}
          onSelectSquare={onDamesSquare}
        />
      ) : null}

      <div className="stack" style={{ marginTop: '1rem' }}>
        {isMyTurnLudo && !ludoState?.pendingDice ? (
          <button className="btn btn-primary" onClick={() => sendAction({ type: 'roll' })}>
            Lancer le dé
          </button>
        ) : null}
        {isMyTurnLudo && ludoState?.pendingDice ? (
          <p className="muted">Sélectionnez un pion mis en évidence, ou passez s’il n’y a pas de coup.</p>
        ) : null}
        {isMyTurnLudo && ludoState?.pendingDice ? (
          <button className="btn btn-secondary" onClick={() => sendAction({ type: 'pass' })}>
            Passer (aucun coup)
          </button>
        ) : null}
        {match.status === 'finished' ? (
          <p className="lede">
            Partie terminée
            {damesState?.winnerId
              ? ` — vainqueur : ${
                  match.players.find((p) => p.userId === damesState.winnerId)?.user.profile
                    ?.username ?? '—'
                }`
              : ludoState
                ? ` — vainqueur : ${
                    match.players.find((p) => p.userId === ludoState.finishedOrder?.[0])?.user
                      .profile?.username ?? '—'
                  }`
                : ''}
          </p>
        ) : null}
        {error ? <p className="error">{error}</p> : null}
      </div>

      <p className="section-label">Joueurs</p>
      {match.players.map((p) => (
        <div className="game-row" key={p.userId}>
          <div className="game-icon">
            {match.gameId === 'dames' ? (p.seat === 0 ? '●' : '○') : ['R', 'V', 'J', 'B'][p.seat]}
          </div>
          <div className="game-meta">
            <strong>{p.user.profile?.displayName ?? p.userId}</strong>
            <span>
              @{p.user.profile?.username}
              {p.user.profile?.nexplayId ? ` · ${p.user.profile.nexplayId}` : ''}
            </span>
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

/** Miroir client des règles (le serveur valide toujours). */
function computeClientLegal(
  state: DamesPublicState,
  side: 'dark' | 'light',
): { from: number; to: number }[] {
  const board = state.board;
  const jumps: { from: number; to: number }[] = [];
  const quiet: { from: number; to: number }[] = [];

  const dirsAll: [number, number][] = [
    [-1, -1],
    [-1, 1],
    [1, -1],
    [1, 1],
  ];

  function rowOf(i: number) {
    return Math.floor(i / 8);
  }
  function colOf(i: number) {
    return i % 8;
  }
  function inB(r: number, c: number) {
    return r >= 0 && r < 8 && c >= 0 && c < 8;
  }

  const fromFilter =
    state.continueFrom !== null
      ? [state.continueFrom]
      : board.map((p, i) => (p?.side === side ? i : -1)).filter((i) => i >= 0);

  for (const from of fromFilter) {
    const piece = board[from];
    if (!piece) continue;
    const r = rowOf(from);
    const c = colOf(from);
    for (const [dr, dc] of dirsAll) {
      const mr = r + dr;
      const mc = c + dc;
      const lr = r + 2 * dr;
      const lc = c + 2 * dc;
      if (!inB(mr, mc) || !inB(lr, lc)) continue;
      const mid = mr * 8 + mc;
      const to = lr * 8 + lc;
      const victim = board[mid];
      if (victim && victim.side !== side && board[to] === null && (mid + to) % 1 === 0) {
        if ((Math.floor(to / 8) + (to % 8)) % 2 === 1) jumps.push({ from, to });
      }
    }
    if (state.continueFrom !== null) continue;
    const forward = piece.king
      ? dirsAll
      : side === 'dark'
        ? [
            [-1, -1],
            [-1, 1],
          ]
        : [
            [1, -1],
            [1, 1],
          ];
    for (const [dr, dc] of forward) {
      const nr = r + dr;
      const nc = c + dc;
      if (!inB(nr, nc)) continue;
      const to = nr * 8 + nc;
      if ((nr + nc) % 2 === 1 && board[to] === null) quiet.push({ from, to });
    }
  }

  return jumps.length > 0 ? jumps : quiet;
}
