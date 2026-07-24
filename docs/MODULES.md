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

## Roadmap jeux

1. ✅ Ludo  
2. ✅ Dames (v2.6)  
3. Échecs (ELO crédibilité)  
4. Dominos  
5. Awalé  
6. Uno  

## V3 (après les jeux)

Matchmaking intelligent, spectateurs, streaming, anti-triche avancé, push mobile, React Native / Flutter, PWA offline.
