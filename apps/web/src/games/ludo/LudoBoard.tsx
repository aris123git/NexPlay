'use client';

type TokenPos = { kind: string; index?: number; slot?: number };

type State = {
  currentSeat: number;
  pendingDice: { value: number } | null;
  players: {
    playerId: string;
    seat: number;
    color: 'red' | 'green' | 'yellow' | 'blue';
    tokens: TokenPos[];
  }[];
};

function canMove(
  state: State,
  playerId: string,
  tokenIndex: number,
): boolean {
  const p = state.players.find((x) => x.playerId === playerId);
  if (!p || !state.pendingDice || state.currentSeat !== p.seat) return false;
  const token = p.tokens[tokenIndex];
  const steps = state.pendingDice.value;
  if (!token) return false;
  if (token.kind === 'yard') return steps === 6;
  // Simplified client hint — server validates
  return true;
}

export function LudoBoard({
  state,
  myPlayerId,
  onSelectToken,
}: {
  state: State;
  myPlayerId: string;
  onSelectToken: (tokenIndex: number) => void;
}) {
  const byColor = Object.fromEntries(state.players.map((p) => [p.color, p])) as Record<
    string,
    State['players'][0] | undefined
  >;

  function Yard({ color }: { color: 'red' | 'green' | 'yellow' | 'blue' }) {
    const p = byColor[color];
    const tokens = p?.tokens ?? [];
    return (
      <div className={`yard ${color}`}>
        {[0, 1, 2, 3].map((i) => {
          const t = tokens[i];
          const inYard = t?.kind === 'yard';
          const selectable =
            !!p &&
            p.playerId === myPlayerId &&
            inYard &&
            canMove(state, myPlayerId, i);
          return (
            <button
              key={i}
              type="button"
              className={`token ${color} ${selectable ? 'selectable' : ''}`}
              style={{ opacity: inYard ? 1 : 0.25 }}
              disabled={!selectable}
              onClick={() => selectable && onSelectToken(i)}
              aria-label={`Pion ${color} ${i + 1}`}
            >
              {i + 1}
            </button>
          );
        })}
      </div>
    );
  }

  const me = state.players.find((p) => p.playerId === myPlayerId);
  const trackTokens =
    me?.tokens
      .map((t, i) => ({ t, i }))
      .filter(({ t }) => t.kind === 'track' || t.kind === 'home') ?? [];

  return (
    <div className="ludo-wrap">
      <div className="ludo-board">
        <Yard color="red" />
        <div className="center-path">Piste</div>
        <Yard color="green" />
        <div className="center-path">Nex<br />Play</div>
        <div className="center-path" style={{ fontSize: '0.7rem', color: 'var(--muted)' }}>
          {state.pendingDice
            ? `Dé ${state.pendingDice.value}`
            : 'En jeu'}
        </div>
        <div className="center-path">Maison</div>
        <Yard color="blue" />
        <div className="center-path">Safe</div>
        <Yard color="yellow" />
      </div>

      {me && trackTokens.length > 0 ? (
        <div>
          <p className="section-label" style={{ marginTop: 0 }}>
            Vos pions en jeu
          </p>
          <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
            {trackTokens.map(({ t, i }) => {
              const selectable = canMove(state, myPlayerId, i);
              return (
                <button
                  key={i}
                  type="button"
                  className={`token ${me.color} ${selectable ? 'selectable' : ''}`}
                  style={{ width: 44, height: 44 }}
                  disabled={!selectable}
                  onClick={() => selectable && onSelectToken(i)}
                >
                  {t.kind === 'home' ? `H${(t.index ?? 0) + 1}` : `T${t.index}`}
                </button>
              );
            })}
          </div>
        </div>
      ) : null}
    </div>
  );
}
