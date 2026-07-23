# Comment ajouter un nouveau jeu sans toucher au cœur

## Objectif

Ajouter Chess, Uno, Awalé, etc. **sans modifier** l’orchestrateur, le matchmaking, ni le schéma générique des matches.

## Étapes

### 1. Créer le package moteur

```
packages/games/<slug>/
  package.json          # name: @nexplay/game-<slug>
  src/
    module.ts           # exporte GameModule
    engine.ts           # règles pures
    index.ts
```

### 2. Implémenter `GameModule`

```ts
import type { GameModule } from '@nexplay/game-core';

export const myGame: GameModule<MyState, MyAction> = {
  id: 'chess',
  name: 'Échecs',
  version: '1.0.0',
  minPlayers: 2,
  maxPlayers: 2,
  modes: [
    { id: 'rapid', label: 'Rapide', config: { timeMs: 600_000 } },
    { id: 'blitz', label: 'Blitz', config: { timeMs: 180_000 } },
    { id: 'classic', label: 'Classique', config: { timeMs: 1_800_000 } },
  ],
  createInitialState(config) { /* … */ },
  validateAction(state, action, playerId) { /* … */ },
  applyAction(state, action) { /* … */ },
  getLegalActions(state, playerId) { /* … */ },
  isTerminal(state) { /* … */ },
  computeStats(state, outcome) { /* … */ },
};
```

### 3. Enregistrer le module (une ligne)

Dans `apps/api/src/games/register.ts` :

```ts
import { chess } from '@nexplay/game-chess';
registry.register(chess);
```

Ou auto-discovery via `package.json` field `"nexplay.game": true"` (Phase 2).

### 4. Seed catalogue

Insérer / upsert dans `game_definitions` :

```sql
INSERT INTO game_definitions (id, name, min_players, max_players, kind, is_enabled)
VALUES ('chess', 'Échecs', 2, 2, 'INTEGRATED', true);
```

### 5. UI dédiée (optionnel au début)

```
apps/web/src/games/chess/
  Board.tsx
  useChessMatch.ts
```

Le lobby générique lit le catalogue API et route vers `/play/chess` ou un renderer dynamique enregistré côté front :

```ts
const renderers = {
  ludo: LudoBoard,
  chess: ChessBoard, // ajout ici seulement
};
```

### 6. Tests

- Tests unitaires du moteur (100% règles, 0 réseau).
- Tests d’intégration : créer match → actions → terminal → stats.

## Ce qu’il ne faut PAS faire

- ❌ Mettre des `if (gameId === 'chess')` dans l’API
- ❌ Valider les coups côté client uniquement
- ❌ Stocker des colonnes spécifiques « white_king_pos » dans `matches`
  → tout l’état spécifique va dans `matches.state` (JSONB)

## Extension e-sport externe

Pour Call of Duty / PUBG / Free Fire :

```ts
{
  id: 'cod-mw',
  kind: 'EXTERNAL',
  // pas de GameModule temps réel obligatoire
  // Tournois utilisent bracket + résultats saisis / webhook
}
```

Le même système de tournois, clans et rewards s’applique ; seul le moteur intégré est absent.
