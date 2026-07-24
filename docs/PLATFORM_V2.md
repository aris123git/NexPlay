# NexPlay V2 — Socle multi-joueurs à l’échelle

> Objectif : ce qui fera la différence à **des milliers de joueurs**, avant d’ajouter Dames / Dominos / Échecs…
> Contrainte : **GameModule inchangé** — tout s’accroche à l’orchestrateur, auth, et events plateforme.

## Modules livrés

| # | Module | Capacité |
|---|--------|----------|
| 1 | **Presence** | online / offline / in_match / in_queue, lastSeen, compteur connectés live |
| 2 | **Chat** | DM, clan, tournoi, match ; emojis ; signalement + modération |
| 3 | **Amis** | invite, accept, favoris, blocage, rejoindre un ami en partie |
| 4 | **Replays** | snapshot de chaque partie finie, share code, revue, signalement triche |
| 5 | **Admin** | back-office users/bans, tournois, saisons, rewards, stats |
| 6 | **Analytics** | online, durée parties, jeux populaires, rétention J1/J7/J30, pays |

## Indépendance des jeux

```
Nouveau jeu (plugin)
        │
        ▼
GameOrchestrator.finalizeMatch
        │
        ├── Presence → idle
        ├── Replay → auto-généré depuis MatchMove
        ├── Analytics → match_end event
        ├── Notifications / Saisons / Wallet / Clans  (V1.5)
        └── Chat match channel archivé
```

Aucun `if (gameId === '…')` dans presence/chat/amis/admin.

## Production (évolution)

- Presence : Redis SET + heartbeat
- Chat : partition messages, rate-limit, profanity filter
- Analytics : ClickHouse / BigQuery
- Admin : RBAC fin, 2FA staff

Voir aussi `docs/MIGRATIONS.md` (delta V2).
