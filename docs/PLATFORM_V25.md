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

Voir aussi `docs/MODULES.md` (vision produit long terme).
