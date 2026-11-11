# Deploying the research agent (Coolify)

The agent (`apps/agent`) is a standalone Node service. It runs from `apps/agent/Dockerfile`, which must be built
with the monorepo root as the context.

## Coolify application

| Setting | Value |
| --- | --- |
| Source | GitHub repository `atriumad/atrium.grader.chat` |
| Branch | `main` (the feature branch until the PR is merged) |
| Build pack | Dockerfile |
| Base directory | `/` |
| Dockerfile location | `/apps/agent/Dockerfile` |
| Ports exposes | `4100` |
| Domain | `https://agents.atriumad.com` (A record to the VPS) |
| Health check | `GET /healthz` on port 4100, expect 200 (the image ships `curl` for it) |

## Environment variables (runtime only: leave "Build Variable" unchecked)

| Variable | Notes |
| --- | --- |
| `AGENT_PORT` | `4100` |
| `SOCIAL_PROVIDER` | `apify` |
| `APIFY_TOKEN` | secret |
| `GOOGLE_PLACES_API_KEY` | secret |
| `AGENT_KEY_HASH_GRADER` | sha256 of the key the web app sends; generate with `node apps/agent/scripts/new-key.ts` |

## Web app

Set on the web deployment: `ANALYZE_VIA_AGENT=1`, `AGENT_URL=https://agents.atriumad.com`,
`AGENT_API_KEY=<the key printed by new-key.ts>`.

## Checks

- `curl https://agents.atriumad.com/healthz` returns `{"ok":true}`.
- `POST /v1/research` without a key returns 401; with the key and an empty body it returns 400, not 401.

## Notes

- The agent keeps its rate limit and cache in memory, so run a single instance.
- Rotate the key by generating a new pair, updating `AGENT_KEY_HASH_GRADER` in Coolify and `AGENT_API_KEY` in the web app.
