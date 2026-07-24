'use client';

type Piece = { side: 'dark' | 'light'; king: boolean } | null;

type State = {
  board: Piece[];
  currentSide: 'dark' | 'light';
  sides: { dark: string; light: string };
  continueFrom: number | null;
  status: string;
  turnNumber: number;
};

function isDarkSquare(i: number): boolean {
  const r = Math.floor(i / 8);
  const c = i % 8;
  return (r + c) % 2 === 1;
}

export function DamesBoard({
  state,
  myPlayerId,
  legalMoves,
  selected,
  onSelectSquare,
}: {
  state: State;
  myPlayerId: string;
  legalMoves: { from: number; to: number }[];
  selected: number | null;
  onSelectSquare: (index: number) => void;
}) {
  const mySide =
    state.sides.dark === myPlayerId
      ? 'dark'
      : state.sides.light === myPlayerId
        ? 'light'
        : null;
  const myTurn = mySide === state.currentSide && state.status === 'active';

  const targets = new Set(
    selected !== null
      ? legalMoves.filter((m) => m.from === selected).map((m) => m.to)
      : [],
  );
  const selectableFrom = new Set(
    myTurn ? legalMoves.map((m) => m.from) : [],
  );

  return (
    <div className="dames-wrap">
      <div className="dames-board" role="grid" aria-label="Plateau de dames">
        {state.board.map((piece, i) => {
          const dark = isDarkSquare(i);
          const isSel = selected === i;
          const isTarget = targets.has(i);
          const canPick = selectableFrom.has(i);
          return (
            <button
              key={i}
              type="button"
              className={[
                'dames-sq',
                dark ? 'dark' : 'light',
                isSel ? 'selected' : '',
                isTarget ? 'target' : '',
                canPick ? 'pickable' : '',
              ]
                .filter(Boolean)
                .join(' ')}
              disabled={!myTurn || (!canPick && !isTarget)}
              onClick={() => onSelectSquare(i)}
              aria-label={`Case ${i}`}
            >
              {piece ? (
                <span
                  className={`dames-piece ${piece.side}${piece.king ? ' king' : ''}`}
                >
                  {piece.king ? '♛' : ''}
                </span>
              ) : isTarget ? (
                <span className="dames-dot" />
              ) : null}
            </button>
          );
        })}
      </div>
      <p className="muted" style={{ textAlign: 'center', marginTop: 8 }}>
        {state.currentSide === 'dark' ? 'Noirs' : 'Blancs'} · Tour {state.turnNumber}
        {state.continueFrom !== null ? ' · Prise obligatoire' : ''}
      </p>
    </div>
  );
}
