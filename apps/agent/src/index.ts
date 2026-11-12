import { dirname, join } from "node:path"
import { fileURLToPath } from "node:url"
import { loadConfig } from "./config.ts"
import { createAgentServer } from "./server.ts"
import { defaultRegistry } from "./tools/index.ts"

const here = dirname(fileURLToPath(import.meta.url))
const config = loadConfig(process.env.AGENT_CONFIG ?? join(here, "..", "agent.config.yaml"))
const registry = defaultRegistry()

const active = config.callers.filter((c) => c.active)
for (const c of active) if (!process.env[c.keyHashEnv]) console.warn(`caller ${c.id}: ${c.keyHashEnv} is not set, its key cannot authenticate`)

const port = Number(process.env.AGENT_PORT ?? process.env.PORT ?? 4100)
createAgentServer({ config, registry, env: process.env }).listen(port, () => {
  console.log(`agent listening on :${port} · callers: ${active.map((c) => c.id).join(", ") || "none"}`)
})
