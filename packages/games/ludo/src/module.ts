import type { GameModule } from '@nexplay/game-core';
import {
  applyLudoAction,
  computeLudoStats,
  createLudoState,
  getLegalLudoActions,
  isLudoTerminal,
  validateLudoAction,
  type LudoAction,
  type LudoState,
} from './engine.js';

export const ludoModule: GameModule<LudoState, LudoAction> = {
  id: 'ludo',
  name: 'Ludo',
  version: '1.0.0',
  minPlayers: 2,
  maxPlayers: 4,
  modes: [
    { id: 'public-2', label: 'Public 2 joueurs', config: { players: 2 } },
    { id: 'public-3', label: 'Public 3 joueurs', config: { players: 3 } },
    { id: 'public-4', label: 'Public 4 joueurs', config: { players: 4 } },
    { id: 'private-2', label: 'Privé 2 joueurs', config: { players: 2, private: true } },
    { id: 'private-3', label: 'Privé 3 joueurs', config: { players: 3, private: true } },
    { id: 'private-4', label: 'Privé 4 joueurs', config: { players: 4, private: true } },
  ],
  createInitialState: createLudoState,
  validateAction: validateLudoAction,
  applyAction: applyLudoAction,
  getLegalActions: getLegalLudoActions,
  isTerminal: isLudoTerminal,
  computeStats: computeLudoStats,
};

export default ludoModule;
