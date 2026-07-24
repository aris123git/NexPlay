import type { GameModule } from '@nexplay/game-core';
import {
  applyDamesAction,
  computeDamesStats,
  createDamesState,
  getLegalDamesActions,
  isDamesTerminal,
  validateDamesAction,
  type DamesAction,
  type DamesState,
} from './engine.js';

export const damesModule: GameModule<DamesState, DamesAction> = {
  id: 'dames',
  name: 'Dames',
  version: '1.0.0',
  minPlayers: 2,
  maxPlayers: 2,
  modes: [
    { id: 'public-2', label: 'Public 2 joueurs', config: { players: 2 } },
    { id: 'private-2', label: 'Privé 2 joueurs', config: { players: 2, private: true } },
    { id: 'rapid', label: 'Rapide', config: { players: 2, timeMs: 600_000 } },
    { id: 'classic', label: 'Classique', config: { players: 2, timeMs: 1_800_000 } },
  ],
  createInitialState: createDamesState,
  validateAction: validateDamesAction,
  applyAction: applyDamesAction,
  getLegalActions: getLegalDamesActions,
  isTerminal: isDamesTerminal,
  computeStats: computeDamesStats,
};

export default damesModule;
