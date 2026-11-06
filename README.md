# Atrium Apps

Monorepo (npm workspaces + Turborepo).

| Path | What |
|---|---|
| `apps/web` | Atrium Grader web app (Next.js) and the API used by mobile |
| `apps/mobile` | Atrium Grader mobile app (Expo) |
| `packages/shared` | `@atrium/shared`: types, chat events, Puntaje Atrium scoring |

## Setup

```bash
npm install
cp apps/web/.env.example apps/web/.env.local       # fill in keys
cp apps/mobile/.env.example apps/mobile/.env       # set EXPO_PUBLIC_API_URL
```

## Scripts

```bash
npm run dev:web        # Next.js on :3000
npm run dev:mobile     # Expo
npm run typecheck
npm run build
```

## Deploy

- Web: Vercel, root directory `apps/web`.
- Mobile: EAS from `apps/mobile` (`eas build -p ios --profile production`). Set `EXPO_PUBLIC_API_URL` in `eas.json` to the deployed web URL first.
