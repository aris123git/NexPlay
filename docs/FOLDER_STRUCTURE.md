# NexPlay — Organisation des dossiers

```
nexplay/
├── apps/
│   ├── api/                      # Backend NestJS-style (Express + Socket.IO V1)
│   │   ├── src/
│   │   │   ├── main.ts
│   │   │   ├── app.ts
│   │   │   ├── config/
│   │   │   ├── auth/
│   │   │   ├── users/
│   │   │   ├── social/           # amis, chat (stubs V1)
│   │   │   ├── matchmaking/
│   │   │   ├── matches/
│   │   │   ├── tournaments/      # stubs V1
│   │   │   ├── clans/            # stubs V1
│   │   │   ├── realtime/         # Socket.IO gateway
│   │   │   ├── games/            # GameOrchestrator + registry
│   │   │   └── common/
│   │   └── prisma/
│   │       └── schema.prisma
│   │
│   └── web/                      # Next.js App Router — mobile-first
│       ├── src/
│       │   ├── app/
│       │   │   ├── (auth)/
│       │   │   ├── (main)/
│       │   │   │   ├── page.tsx          # lobby / home
│       │   │   │   ├── play/
│       │   │   │   ├── match/[id]/
│       │   │   │   ├── profile/
│       │   │   │   └── leaderboard/
│       │   │   └── layout.tsx
│       │   ├── components/
│       │   ├── games/
│       │   │   └── ludo/                 # UI Ludo uniquement
│       │   ├── lib/                      # api client, socket, auth
│       │   └── styles/
│       └── public/
│
├── packages/
│   ├── game-core/                # Contrat plugin + types partagés
│   │   └── src/
│   │       ├── types.ts
│   │       ├── registry.ts
│   │       ├── rating.ts             # ELO générique
│   │       └── index.ts
│   │
│   └── games/
│       ├── ludo/                 # Module Ludo (moteur + règles)
│       │   └── src/
│       │       ├── engine.ts
│       │       ├── board.ts
│       │       ├── dice.ts
│       │       ├── module.ts
│       │       └── index.ts
│       ├── chess/                 # (futur)
│       ├── checkers/             # (futur)
│       ├── awale/                # (futur)
│       └── domino/               # (futur)
│
├── docs/
│   ├── ARCHITECTURE.md
│   ├── DATABASE.md
│   ├── FOLDER_STRUCTURE.md
│   └── ADD_GAME.md
│
├── package.json                  # workspaces npm
├── tsconfig.base.json
└── README.md
```

## Responsabilités

| Chemin | Responsabilité |
|--------|----------------|
| `packages/game-core` | Contrats stables, registry, ELO, sérialisation |
| `packages/games/*` | Moteurs de règles purs (pas d’HTTP, pas de DB) |
| `apps/api` | Auth, orchestration, persistence, realtime |
| `apps/web` | UI mobile-first ; rendu + input joueur |
| `docs/` | Architecture et guides |

## Règle d’or

Le **cœur** (`api` + `game-core`) ne contient **aucune** règle spécifique à un jeu.
Tout ce qui est « comment on joue au Ludo » vit dans `packages/games/ludo`.
