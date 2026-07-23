# NexPlay — Modèle de base de données

## Diagramme entité-relation (simplifié)

```
users ─┬─ player_profiles
       ├─ friendships
       ├─ clan_members ── clans
       ├─ match_players ── matches ── match_moves
       ├─ tournament_entries ── tournaments
       ├─ player_game_stats
       ├─ badges / player_badges
       └─ refresh_tokens

games_definitions (catalogue)
matchmaking_tickets (éphémère → Redis en prod)
chat_channels / chat_messages
rewards / reward_grants
```

## Choix techniques

- **Production** : PostgreSQL 16 (UUID PK, JSONB pour états de partie, partitions sur `match_moves` par mois).
- **V1 locale** : SQLite via Prisma pour démarrer sans infra.
- **Redis** : tickets matchmaking, presence, état live des rooms, pub/sub Socket.IO.
- **ClickHouse** (futur) : events analytics, snapshots ELO.

---

## Tables principales

### users
| Colonne | Type | Notes |
|---------|------|-------|
| id | UUID PK | |
| email | CITEXT UNIQUE | |
| password_hash | TEXT | argon2id |
| status | ENUM | active, banned, deleted |
| created_at / updated_at | TIMESTAMPTZ | |

### player_profiles
| Colonne | Type | Notes |
|---------|------|-------|
| user_id | UUID PK/FK | |
| username | CITEXT UNIQUE | pseudo |
| display_name | TEXT | |
| avatar_url | TEXT | |
| country_code | CHAR(2) | BF par défaut |
| locale | TEXT | fr-BF, en-US… |
| currency | CHAR(3) | XOF, EUR… |
| level | INT | |
| xp | BIGINT | |
| bio | TEXT | |

### friendships
| Colonne | Type | Notes |
|---------|------|-------|
| id | UUID | |
| requester_id / addressee_id | UUID | |
| status | ENUM | pending, accepted, blocked |
| UNIQUE(requester_id, addressee_id) | | |

### clans
| Colonne | Type | Notes |
|---------|------|-------|
| id | UUID | |
| name | UNIQUE | |
| tag | VARCHAR(6) | |
| logo_url | TEXT | |
| country_code | CHAR(2) | |
| owner_id | UUID | |
| rating | INT | classement clan |

### clan_members
role: owner | admin | member

### game_definitions
Catalogue des jeux installés (id = `ludo`, `chess`…).
| Colonne | Type | Notes |
|---------|------|-------|
| id | TEXT PK | slug module |
| name | TEXT | |
| min_players / max_players | INT | |
| is_enabled | BOOL | |
| kind | ENUM | INTEGRATED, EXTERNAL |
| config_schema | JSONB | modes, time controls |

### matches
| Colonne | Type | Notes |
|---------|------|-------|
| id | UUID | |
| game_id | TEXT FK | |
| mode | TEXT | private, public, ranked… |
| visibility | ENUM | public, private |
| status | ENUM | waiting, active, finished, cancelled |
| region | TEXT | |
| invite_code | TEXT UNIQUE | parties privées |
| state | JSONB | état autoritatif courant |
| started_at / finished_at | TIMESTAMPTZ | |
| winner_ids | UUID[] | |

### match_players
| Colonne | Type | Notes |
|---------|------|-------|
| match_id + user_id | PK | |
| seat | INT | position / couleur |
| team_id | UUID? | |
| result | ENUM | win, loss, draw, abandon |
| rating_before / rating_after | INT | ELO |
| xp_gained | INT | |

### match_moves
| Colonne | Type | Notes |
|---------|------|-------|
| id | BIGSERIAL | |
| match_id | UUID | |
| seq | INT | ordre |
| player_id | UUID | |
| action | JSONB | action brute validée |
| state_hash | TEXT | intégrité |
| created_at | TIMESTAMPTZ | |

### player_game_stats
Agrégats par (user_id, game_id) : played, wins, losses, draws, elo, streak…

### tournaments
| Colonne | Type | Notes |
|---------|------|-------|
| id | UUID | |
| game_id | TEXT | ludo ou EXTERNAL:cod |
| format | ENUM | single_elim, double_elim, swiss, round_robin |
| scope | ENUM | individual, team |
| status | ENUM | draft, open, running, completed |
| bracket | JSONB | |
| schedule | JSONB | calendrier |
| rewards | JSONB | |
| region / country_code | | |

### tournament_entries
player_id ou clan_id, seed, placement

### badges / player_badges / rewards / reward_grants
Métadonnées cosmétiques et monétaires (XOF, points boutique).

### chat_channels / chat_messages
DM, groupe, match room, clan.

### refresh_tokens
Rotation sécurisée des sessions.

---

## Index & perf

- `matches(status, game_id, created_at)`
- `match_moves(match_id, seq)` UNIQUE
- `player_game_stats(user_id, game_id)` UNIQUE
- `friendships` partial indexes sur status
- Partitionnement mensuel `match_moves` en prod
- État live en Redis clé `match:{id}:state` avec TTL + flush périodique PostgreSQL

---

## Multi-pays / i18n

- `country_code`, `locale`, `currency` sur le profil
- Tables de traduction UI côté frontend (next-intl)
- Contenu dynamique : clés i18n + fallback `fr`
- Devises : montants en **minor units** + `currency` ; conversion via service FX (Phase 2)
