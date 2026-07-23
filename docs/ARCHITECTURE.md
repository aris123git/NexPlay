# NexPlay — Architecture Technique

## Vision

NexPlay est une plateforme mondiale de jeux compétitifs. Le lancement commence au Burkina Faso ; l’architecture est conçue dès le jour 1 pour **multi-pays, multi-langues, multi-devises et millions de joueurs concurrents**.

---

## 1. Vue d’ensemble

```
┌─────────────────────────────────────────────────────────────────┐
│                     Clients (Mobile-first)                       │
│         Next.js PWA  ·  iOS/Android (futur React Native)         │
└────────────────────────────┬────────────────────────────────────┘
                             │ HTTPS / WSS
┌────────────────────────────▼────────────────────────────────────┐
│                      Edge / CDN (Cloudflare)                     │
│              Static assets · Geo routing · DDoS                  │
└────────────────────────────┬────────────────────────────────────┘
                             │
┌────────────────────────────▼────────────────────────────────────┐
│                     API Gateway (Kong / Nginx)                   │
│         Auth JWT · Rate limit · Routing · Observability          │
└──────┬──────────────────┬──────────────────┬────────────────────┘
       │                  │                  │
┌──────▼──────┐  ┌────────▼────────┐  ┌──────▼──────────────────┐
│  Auth API   │  │  Platform API   │  │  Realtime Gateway        │
│  NestJS     │  │  NestJS         │  │  Socket.IO / Redis Adapter│
│  Users      │  │  Social         │  │  Match rooms             │
│  Profiles   │  │  Tournaments    │  │  Chat                    │
│  Sessions   │  │  Clans          │  │  Presence                │
└──────┬──────┘  └────────┬────────┘  └──────┬──────────────────┘
       │                  │                  │
       │         ┌────────▼────────┐         │
       │         │  Game Orchestrator│◄───────┘
       │         │  (plugin loader)  │
       │         └────────┬────────┘
       │                  │
       │    ┌─────────────┼─────────────┐
       │    ▼             ▼             ▼
       │  Ludo         Chess        Checkers … (modules)
       │
┌──────▼──────────────────▼──────────────────────────────────────┐
│                         Data Layer                              │
│  PostgreSQL (primary)  ·  Redis (cache/pubsub/matchmaking)      │
│  Object Storage (avatars/logos)  ·  ClickHouse (analytics)      │
└─────────────────────────────────────────────────────────────────┘
```

---

## 2. Stack technologique (cible production)

| Couche | Technologie | Rôle |
|--------|-------------|------|
| Frontend | Next.js 15 (App Router) + PWA | Mobile-first, SSR/SSG, i18n |
| Mobile natif (Phase 2) | React Native / Expo | Parité feature |
| API HTTP | NestJS (TypeScript) | REST/GraphQL, validation, DI |
| Temps réel | Socket.IO + Redis Adapter | Rooms, presence, game sync |
| Matchmaking | Redis Sorted Sets + workers | Files par jeu / skill / région |
| BDD primaire | PostgreSQL 16 | ACID, partitions, JSONB états |
| Cache / PubSub | Redis 7 Cluster | Sessions, MM, presence |
| Analytics | ClickHouse | Stats, ELO history, anti-cheat signals |
| Stockage fichiers | S3-compatible | Avatars, logos clans |
| Auth | JWT + refresh, OAuth (futur) | Sessions sécurisées |
| Anti-triche | Server-authoritative engines | Dés crypto, validation serveur |
| Infra | Kubernetes + HPA | Scale horizontal |
| Observabilité | OpenTelemetry, Prometheus, Grafana | Latence, erreurs, rooms actives |

### Principes de scalabilité

1. **Server-authoritative** : le client propose une action ; le serveur valide et diffuse l’état.
2. **Stateless API** : sessions JWT ; état de partie en Redis + snapshot PostgreSQL.
3. **Sharding des rooms** : sticky sessions Socket.IO via Redis Adapter.
4. **Isolation des jeux** : chaque jeu = module plugin, déployable indépendamment plus tard.
5. **i18n / locales** : `country`, `locale`, `currency` sur le profil ; messages via ICU.
6. **Multi-région** : edge + DB réplicas read ; matchmaking préfère la même région.

---

## 3. Architecture des jeux (plugin system)

Chaque jeu implémente le contrat `GameModule` du package `@nexplay/game-core` :

```
GameModule {
  id, name, version
  minPlayers, maxPlayers
  modes[]                    // rapid, blitz, classic, private, public…
  createInitialState(config) // état initial déterministe
  validateAction(state, action, playerId) → ValidationResult
  applyAction(state, action) → { state, events }
  getLegalActions(state, playerId)
  isTerminal(state) → Outcome | null
  computeStats(state, outcome) → PlayerStatDelta[]
  serialize / deserialize    // pour Redis / DB
}
```

Le **Game Orchestrator** :

1. Charge le registre des modules (`GameRegistry`).
2. Crée une `Match` (DB) + room Socket.IO.
3. Applique uniquement des actions validées côté serveur.
4. Persiste historique des coups (`MatchMove`).
5. Met à jour ELO / XP / badges à la fin.

**Ajouter un jeu** = créer un package sous `packages/games/<slug>`, enregistrer dans le registry — **zéro modification du cœur** (voir `docs/ADD_GAME.md`).

---

## 4. Domaines fonctionnels

### Auth & Profil
Compte, JWT, pseudo unique, avatar, pays (ISO 3166), locale, niveau, XP, badges.

### Social
Amis, invitations, chat 1:1 / groupe, présence online.

### Matchmaking
Queues Redis par `(gameId, mode, skillBracket, region)`. Timeout → élargissement de bracket.

### Tournois
Bracket single/double elim, Swiss (futur), individuels & équipes, inscriptions, rewards.

### Clans / Équipes
Création, logo, rôles (owner/admin/member), classement clan.

### Compétitions externes (e-sport Phase 2+)
Calendrier, inscriptions équipes, résultats manuels/API, classements, rewards — même modèle `Tournament` avec `gameKind = EXTERNAL`.

### Anti-triche
- Dés : `crypto.randomInt` + seed HMAC serveur, jamais côté client.
- Mouvements : validation moteur serveur uniquement.
- Rate-limit actions / room.
- Replay & audit trail des coups.
- Signaux anomaly (latence impossible, pattern bot) → ClickHouse.

---

## 5. Déploiement progressif

| Phase | Contenu |
|-------|---------|
| **V1 (actuelle)** | Monorepo, game-core, Ludo, auth, matchmaking local, UI mobile-first |
| V1.1 | Dames, Awalé, Dominos |
| V1.2 | Échecs + ELO |
| V2 | Tournois, clans, chat |
| V3 | Compétitions externes COD/PUBG/FF/FC/Fortnite |
| V4 | Multi-région K8s, analytics, anti-cheat avancé |

---

## 6. Sécurité

- HTTPS/WSS obligatoire
- Mots de passe argon2id
- JWT court + refresh rotatif
- CORS strict
- Validation Zod/class-validator sur toutes les entrées
- Secrets via env / Vault
- RGPD / données perso : consentement, export, suppression
