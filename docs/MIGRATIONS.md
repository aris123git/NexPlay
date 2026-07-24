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

## Delta V2 (présence, social, replays, admin, analytics)

### Nouvelles tables
- `FriendFavorite`
- `ChatChannel`, `ChatMessage`, `ChatReport`
- `MatchReplay`, `CheatReport`
- `AnalyticsEvent`, `AdminAuditLog`

### Enrichissements
- `User.role`, `bannedAt`, `banReason`
- `PlayerProfile.presenceStatus`, `lastSeenAt`, `currentMatchId`

```bash
cd apps/api && npx prisma db push && npm run db:seed
```

Admin seed : `admin@nexplay.local` / `adminadmin`
