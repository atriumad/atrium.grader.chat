# Build from the monorepo root:  docker build -f apps/agent/Dockerfile -t atrium-agent .
FROM node:24-slim
ENV NODE_ENV=production
WORKDIR /app

# Coolify (and most platforms) run their health check with curl inside the container.
RUN apt-get update && apt-get install -y --no-install-recommends curl && rm -rf /var/lib/apt/lists/*

# Only what the agent needs: the workspace manifests first (cached layer), then the sources.
COPY package.json package-lock.json ./
COPY apps/agent/package.json apps/agent/
COPY packages/shared/package.json packages/shared/
COPY packages/sources/package.json packages/sources/
RUN npm ci --omit=dev --workspace=@atrium/agent --include-workspace-root=false

COPY apps/agent apps/agent
COPY packages/shared packages/shared
COPY packages/sources packages/sources

USER node
EXPOSE 4100
WORKDIR /app/apps/agent
# Node 24 runs the TypeScript sources directly. Config and keys come from the environment.
CMD ["node", "src/index.ts"]
