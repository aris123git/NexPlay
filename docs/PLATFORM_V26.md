# NexPlay V2.6 — Dames + NexPlay ID

> Un jeu à la fois. Après V2.5 (infra mondiale) : **Dames** comme second module intégré.

## NexPlay ID

Identité officielle du joueur sur toute la plateforme :

| Forme | Exemple | Usage |
|-------|---------|--------|
| ID canonique | `NXP-4F8A-29C1` | amis, tournois, classements, e-sport |
| Tag affiché | `Aristide#29C1` | UI sociale |

Généré à l’inscription, exposé sur `/auth/me` et le profil.

## Dames (`@nexplay/game-dames`)

- Variante anglaise 8×8, 1v1
- Prises obligatoires, multi-prises, dames (rois)
- Modes : `public-2`, `private-2`, `rapid`, `classic`
- Enregistré dans `games/register.ts` — **aucune** branche `if (gameId === …)` hors UI

## Suite

1. ✅ Ludo  
2. ✅ Dames (cette version)  
3. Échecs (v2.7)  
4. Dominos  
5. Awalé  
6. Uno  

Avant V3 : infra cloud production (Postgres HA, Redis, object storage, CI/CD, observabilité…).
