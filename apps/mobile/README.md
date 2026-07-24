# @nexplay/mobile — Expo (hors workspaces npm pour éviter conflit React 19 web / RN 18)

## Setup

```bash
cd apps/mobile
npm install
# Device physique : EXPO_PUBLIC_API_URL=http://<IP-LAN>:4000
npx expo start
```

Écrans : accueil, auth, file d’attente Ludo/Dames.
Le plateau temps réel reste sur la PWA web en V3.5 ; le board natif suivra.
