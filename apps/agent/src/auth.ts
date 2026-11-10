import { createHash, timingSafeEqual } from "node:crypto"
import type { AgentConfig, CallerConfig } from "./config.ts"

export const hashKey = (key: string): string => createHash("sha256").update(key).digest("hex")

// Keys are never stored: each caller has the sha256 of its key in the environment variable named by `keyHashEnv`.
export function authenticate(
  config: Pick<AgentConfig, "callers">,
  authorization: string | undefined,
  env: Record<string, string | undefined>
): CallerConfig | null {
  const match = authorization?.match(/^Bearer\s+(\S+)$/i)
  if (!match) return null
  const presented = Buffer.from(hashKey(match[1]), "hex")
  let found: CallerConfig | null = null
  // Compare against every caller so the time taken does not reveal which ones exist.
  for (const caller of config.callers) {
    const stored = env[caller.keyHashEnv]
    if (!caller.active || !stored || !/^[0-9a-f]{64}$/i.test(stored)) continue
    if (timingSafeEqual(presented, Buffer.from(stored, "hex"))) found = caller
  }
  return found
}
