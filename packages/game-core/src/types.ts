/**
 * NexPlay Game Core — contrats stables pour tous les jeux intégrés.
 * Aucune règle spécifique à un jeu ici.
 */

export type PlayerId = string;

export type GameMode = {
  id: string;
  label: string;
  /** Config libre interprétée uniquement par le module (timeMs, boardSize…) */
  config?: Record<string, unknown>;
};

export type MatchConfig = {
  modeId: string;
  playerIds: PlayerId[];
  /** Options spécifiques (seed, time control…) */
  options?: Record<string, unknown>;
};

export type ValidationResult =
  | { ok: true }
  | { ok: false; code: string; message: string };

export type GameEvent = {
  type: string;
  payload?: Record<string, unknown>;
};

export type ApplyResult<TState> = {
  state: TState;
  events: GameEvent[];
};

export type Outcome = {
  kind: 'win' | 'draw' | 'cancelled';
  /** Joueurs gagnants (vide si draw/cancelled) */
  winnerIds: PlayerId[];
  reason?: string;
};

export type PlayerStatDelta = {
  playerId: PlayerId;
  result: 'win' | 'loss' | 'draw' | 'abandon';
  xp: number;
  /** Delta ELO proposé (l’API peut recalculer) */
  eloDelta?: number;
  extras?: Record<string, number>;
};

/**
 * Contrat plugin : chaque jeu l’implémente.
 * TState / TAction sont propres au jeu et stockés en JSONB.
 */
export interface GameModule<TState = unknown, TAction = unknown> {
  readonly id: string;
  readonly name: string;
  readonly version: string;
  readonly minPlayers: number;
  readonly maxPlayers: number;
  readonly modes: GameMode[];

  createInitialState(config: MatchConfig): TState;
  validateAction(
    state: TState,
    action: TAction,
    playerId: PlayerId,
  ): ValidationResult;
  applyAction(state: TState, action: TAction): ApplyResult<TState>;
  getLegalActions(state: TState, playerId: PlayerId): TAction[];
  isTerminal(state: TState): Outcome | null;
  computeStats(state: TState, outcome: Outcome): PlayerStatDelta[];
}

export type AnyGameModule = GameModule<any, any>;
