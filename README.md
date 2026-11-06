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

## Panel administrativo (`/admin`)

Controla el comportamiento de las apps sin tocar código: reglas del puntaje, instrucciones y herramientas de los agentes, base de conocimiento y métricas de uso. Guarda todo en Supabase; si no está configurado, las apps usan los valores por defecto del código.

**Configuración (una vez):**
1. Crea un proyecto en Supabase y ejecuta `supabase/migrations/0001_admin.sql` en el SQL Editor.
2. En Authentication → URL Configuration: Site URL = tu dominio y Redirect URL = `https://TU-DOMINIO/auth/callback` (en local, `http://localhost:3000/auth/callback`).
3. Variables en `apps/web/.env.local` y en Vercel: `NEXT_PUBLIC_SUPABASE_URL`, `NEXT_PUBLIC_SUPABASE_ANON_KEY`, `SUPABASE_SERVICE_ROLE_KEY` y `ADMIN_EMAILS`.
4. Entra a `/admin` con un correo de `ADMIN_EMAILS`; recibirás un enlace.

**Secciones:** Resumen (uso, créditos de ScrapeCreators, herramientas del agente), Puntaje (pesos, niveles y parámetros con vista previa sobre análisis reales e historial), Agentes (tono, instrucciones, herramientas) y Conocimiento (PDF/TXT/MD/CSV/JSON o texto pegado; búsqueda para el chat y documentos "usar siempre").

Las reglas del puntaje viajan dentro de cada análisis, así web y app puntúan igual y un análisis ya hecho conserva las reglas con las que se generó.
