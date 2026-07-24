# API publique NexPlay

## Créer une clé

```bash
curl -X POST http://localhost:4000/api/developer/keys \
  -H "Authorization: Bearer <JWT>" \
  -H "Content-Type: application/json" \
  -d '{"name":"My integration","scopes":["read:public"]}'
```

La réponse contient `apiKey` **une seule fois** (`nxp_…`).

## Appeler l’API

```bash
curl http://localhost:4000/public/v1/games \
  -H "X-Api-Key: nxp_…"
```

Spec OpenAPI : `docs/openapi-public.json`

## Endpoints v1

| Méthode | Chemin | Description |
|---------|--------|-------------|
| GET | `/public/v1/health` | Santé + online |
| GET | `/public/v1/games` | Catalogue jeux |
| GET | `/public/v1/leaderboards/{gameId}` | Classements |
| GET | `/public/v1/seasons` | Saisons |
| GET | `/public/v1/clans/leaderboard` | Clans |
| GET | `/public/v1/shop` | Boutique |
| GET | `/public/v1/i18n` | Localisation |
| GET | `/public/v1/tournaments` | Tournois |

Scopes futurs : `write:tournaments`, `read:private` (non exposés en V2.5).
