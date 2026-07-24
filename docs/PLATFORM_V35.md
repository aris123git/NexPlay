# NexPlay V3.5 — Mobile, PWA & faible connexion

> Objectif : rendre NexPlay **jouable partout**, y compris sur mobile et réseaux contraints (Afrique de l’Ouest et diaspora).

## Piliers

| Pilier | Contenu |
|--------|---------|
| **PWA** | Manifest, Service Worker, shell offline, installable, cache assets |
| **Faible connexion** | Mode dédié : moins d’animations, polling long, Socket en polling, payloads allégés |
| **Réseau** | Compression HTTP, Cache-Control, retry/backoff client, timeouts |
| **Mobile** | App Expo (React Native) — auth, lobby, file d’attente Ludo/Dames |
| **Push (socle)** | Abonnements Web Push stockés côté API (VAPID ready) |

## Architecture

```
apps/web     → PWA Next.js (installable + offline)
apps/mobile  → Expo / React Native (iOS + Android)
apps/api     → compression, cache, /api/push, ?lite=1
```

Même API JWT — **pas de fork métier**. Un jeu = toujours un `GameModule`.

## Mode faible connexion

Activable dans **Réglages** (persisté `localStorage` + sync profil optionnelle).

Effets :
- `body.low-bandwidth` — animations / effets réduits
- Socket.IO : transport `polling` préféré
- Polling match : intervalle ×2–3
- `Accept-Encoding` + header `X-NexPlay-Lite: 1`
- Fonts système en secours si Google Fonts indisponibles (SW)

## Mobile

```bash
cd apps/mobile && npm install && npx expo start
```

Configurer `EXPO_PUBLIC_API_URL` (IP LAN en device physique).

## Hors scope V3.5 (V3.0 / V4)

Matchmaking intelligent complet, spectateurs live, streaming e-sport — documentés dans `MODULES.md`, à enchaîner séparément.
