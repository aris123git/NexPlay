# Changelog schéma — Fondation plateforme

## Delta vs V1 initiale

### Nouvelles tables
- `Wallet`, `WalletTransaction`, `DailyRewardClaim` — NexCoins
- `Notification` — centre de notifs + push Socket.IO
- `MatchInvite` — invitations de partie
- `Season`, `SeasonStanding` — saisons compétitives
- `TournamentMatch`, `ExternalResult` — bracket + preuves e-sport externe

### Tables enrichies
- `PlayerProfile.avatarUrl` — presets `preset://…`
- `Clan.score`, `description`, `maxMembers` ; `ClanMember.userId` unique
- `Match.seasonId`, `tournamentMatchId`
- `MatchPlayer.coinsGained`
- `PlayerGameStat.bestStreak`
- `Tournament.gameKind`, `maxEntries`, `seasonId`, dates

## Appliquer (dev SQLite)

```bash
cd apps/api
npx prisma db push
npm run db:seed
```

Production PostgreSQL : générer une migration versionnée

```bash
npx prisma migrate dev --name platform_foundation
```

## Non-régression GameModule

Aucun changement dans `@nexplay/game-core` ni `@nexplay/game-ludo`.
Les hooks sont uniquement dans `GameOrchestrator.finalizeMatch`.
