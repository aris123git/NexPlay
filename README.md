# NexPlay

Plateforme mondiale de jeux compétitifs — lancement Burkina Faso, architecture multi-pays.

## Documentation

- [Architecture](docs/ARCHITECTURE.md)
- [Modèle de données](docs/DATABASE.md)
- [Organisation des dossiers](docs/FOLDER_STRUCTURE.md)
- [Ajouter un jeu](docs/ADD_GAME.md)

## Stack V1

| Couche | Techno |
|--------|--------|
| Frontend | Next.js 15 (mobile-first) |
| API | Express + Socket.IO |
| Jeux | Plugins `@nexplay/game-*` |
| BDD | Prisma + SQLite (PostgreSQL en prod) |

## Démarrage rapide

```bash
npm install
npm run build -w @nexplay/game-core
npm run build -w @nexplay/game-ludo
npm run db:push -w @nexplay/api
npm run db:seed -w @nexplay/api
npm run dev
```

- Web : http://localhost:3000
- API : http://localhost:4000

## V1.5 — Fondation compétitive

Avant d’ajouter de nouveaux jeux, le socle plateforme inclut :

- Notifications temps réel
- Saisons + classement
- NexCoins + récompense quotidienne
- Tournament Engine (intégré + e-sport externe)
- Clans
- Profil avancé (stats, historique, badges, XP, avatar)

Voir `docs/PLATFORM_FOUNDATION.md` et `docs/MIGRATIONS.md`.

## V1 livrée

- Architecture modulaire jeux
- Auth (register / login / profil)
- Matchmaking public + parties privées
- **Ludo** (2–4 joueurs, dés sécurisés serveur, historique, stats/ELO)
- Classement, badges

## Ajouter un jeu

Voir `docs/ADD_GAME.md` — créer `packages/games/<slug>`, implémenter `GameModule`, `registry.register(...)`.
