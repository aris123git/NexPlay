import { createRegistry } from '@nexplay/game-core';
import { ludoModule } from '@nexplay/game-ludo';
import { damesModule } from '@nexplay/game-dames';

/**
 * Point d’extension : enregistrer chaque nouveau jeu ici (une ligne).
 * Voir docs/ADD_GAME.md
 */
export const gameRegistry = createRegistry();
gameRegistry.register(ludoModule);
gameRegistry.register(damesModule);

export function listInstalledGames() {
  return gameRegistry.list().map((g) => ({
    id: g.id,
    name: g.name,
    version: g.version,
    minPlayers: g.minPlayers,
    maxPlayers: g.maxPlayers,
    modes: g.modes,
  }));
}
