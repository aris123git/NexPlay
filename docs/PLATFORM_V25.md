# NexPlay V2.5 — Infrastructure mondiale

> Avant Dames / Échecs : ce qui est **très difficile à greffer plus tard**.
> Contrainte : **GameModule inchangé** — cosmétique, i18n, rankings, events et API publique sont transverses.

## Modules

| Pilier | Contenu |
|--------|---------|
| **i18n** | fr, en, ar, pt, es — fuseaux, dates, devises, drapeaux, UI traduite |
| **Classements** | monde / continent / pays / région — par jeu, saison, clans |
| **Économie** | Boutique NexCoins 100% cosmétique (avatars, cadres, émotes, skins dés, plateaux…) |
| **Événements** | Défis quotidiens / hebdo, missions, events saisonniers |
| **API publique** | Clés API + OpenAPI — intégrations & futurs plugins |

## Indépendance jeux

```
Shop / Cosmetics  ──► équipés sur le profil (JSON)
Events / Missions ──► progressent via match_end (gameId générique)
Rankings          ──► agrègent PlayerGameStat / SeasonStanding / Clan
i18n              ──► frontend + locale profil
Public API        ──► lecture catalogue / leaderboards / tournois
```

Aucun déséquilibre compétitif : **pas de pay-to-win**.

## Endpoints internes (`/api`)

| Zone | Chemins |
|------|---------|
| i18n | `GET /i18n/catalog`, `PATCH /i18n/preferences` |
| Rankings | `GET /rankings/game/:gameId`, `/rankings/season/active`, `/rankings/clans` |
| Shop | `GET /shop`, `POST /shop/purchase`, `POST /shop/equip` |
| Events | `GET /events/challenges`, `POST /events/challenges/:id/claim` |
| Developer | `POST /developer/keys` |

## UI

`/shop`, `/events`, `/leaderboard`, `/settings` + sélecteur de langue (FR/EN/AR/PT/ES, RTL arabe).

## Docs liées

- `docs/MODULES.md` — vision Core / Games / Arena / Esports / Creator / Studio
- `docs/PUBLIC_API.md` + `docs/openapi-public.json`
- Roadmap jeux **après** V2.5 : Dames → Échecs → Dominos → Awalé → Uno
