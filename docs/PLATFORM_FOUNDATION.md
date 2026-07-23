# NexPlay — Renforcement du socle plateforme (post-V1)

> Objectif : solidifier l’infrastructure compétitive **avant** d’ajouter Dames / Échecs / Dominos / Awalé / Uno.
> Contrainte : **ne pas casser** `GameModule` / `@nexplay/game-core` / le moteur Ludo.

## Changements livrés

| Domaine | Ajout | Fichiers clés |
|---------|-------|---------------|
| Notifications temps réel | Invitations, fin de match, tournoi | `notifications/`, gateway Socket.IO |
| Saisons | Saison active, standings, rewards | `seasons/` |
| Profil avancé | Stats, winrate, historique, badges, XP, drapeau, avatar | `/auth/me`, `/api/profile/*` |
| NexCoins | Wallet virtuel, daily reward, gains de match | `wallet/` |
| Tournament Engine | Bracket générique INTEGRATED + EXTERNAL | `tournaments/engine.ts` |
| Clans | CRUD, membres, score, classement | `clans/` |

## Principes

1. **GameModule inchangé** — les récompenses / saisons / notifs s’accrochent à `GameOrchestrator.finalizeMatch`, pas au moteur de jeu.
2. **Tournament Engine agnostique** — `gameKind: INTEGRATED | EXTERNAL` ; pour EXTERNAL, soumission de résultat + validation admin.
3. **Migrations** — schéma Prisma étendu ; `prisma db push` (SQLite V1) + doc des deltas.
4. **Temps réel** — event `notify` sur room `user:{id}` ; persistance `Notification` pour offline.

## Flux match terminé (enrichi)

```
isTerminal → finalizeMatch
  → stats / ELO / XP / badges          (existant)
  → wallet.credit(NexCoins)            (nouveau)
  → seasons.recordMatchResult          (nouveau)
  → notifications.match_result         (nouveau)
  → clans.addScore (si membre)         (nouveau)
```

## Tournament Engine

```
create → open registration → seed & generateBracket
  → (INTEGRATED) spawn Match via orchestrator
  → (EXTERNAL) submitResult + evidenceUrl → validate
  → advanceWinner → next round → complete → grant rewards
```

## Prochaines étapes (hors cette PR)

1. Dames / Échecs / Dominos / Awalé / Uno (plugins)
2. Upload avatar S3
3. Redis pour files de notifs / presence
4. Argent réel (plus tard — volontairement exclu)
