# NexPlay — Vision modules produit

NexPlay n’est plus « une app Ludo » : c’est un **écosystème de modules**.

```
┌─────────────────────────────────────────────────────────┐
│                    NexPlay Platform                      │
├─────────────┬─────────────┬─────────────┬───────────────┤
│ Core        │ Games       │ Arena       │ Esports       │
│ comptes     │ Ludo        │ tournois    │ COD / PUBG    │
│ profils     │ Dames*      │ ligues      │ Free Fire     │
│ économie    │ Échecs*     │ saisons     │ EA FC         │
│ social      │ Dominos*    │ classements │ preuves       │
│ notifs      │ Awalé*      │            │               │
│ i18n        │ Uno*        │            │               │
├─────────────┴─────────────┴─────────────┴───────────────┤
│ Creator          │ Studio (futur)                        │
│ replays, clips   │ SDK plugins jeux                      │
│ streaming*       │ API publique                          │
└──────────────────┴───────────────────────────────────────┘
* roadmap
```

## Règle d’or

**Un jeu = un package `@nexplay/game-<slug>` implémentant `GameModule`.**

Tout le reste (Core / Arena / Esports / Creator) doit fonctionner **sans connaître les règles** du jeu.

## Roadmap jeux (après V2.5)

1. Dames  
2. Échecs (ELO crédibilité)  
3. Dominos  
4. Awalé  
5. Uno  

## V3 (après les jeux)

Matchmaking intelligent, spectateurs, streaming, anti-triche avancé, push mobile, React Native / Flutter, PWA offline.
