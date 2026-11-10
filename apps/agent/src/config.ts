import { readFileSync } from "node:fs"
import { parse } from "yaml"

export type Budget = { maxToolCalls: number; maxSeconds: number; maxCostCents: number }

export type ProfileConfig = {
  description?: string
  inherits?: string
  tools: string[]
  privateData: boolean
  requireClientId?: boolean
}

export type ToolConfig = {
  enabled: boolean
  profile: string
  timeoutSeconds?: number
  costCentsEstimate?: number | null
}

export type RequestTypeConfig = {
  description?: string
  enabled?: boolean
  tools: string[]
  required: string[]
  optional: string[]
  budget: Budget
}

export type CallerConfig = {
  id: string
  name: string
  profile: string
  keyHashEnv: string
  allowedRequestTypes: string[]
  budget: Budget
  rateLimit?: { requestsPerMinute: number }
  monthlyCostCapCents?: number
  active: boolean
}

export type AgentConfig = {
  version: 1
  profiles: Record<string, ProfileConfig>
  tools: Record<string, ToolConfig>
  requestTypes: Record<string, RequestTypeConfig>
  callers: CallerConfig[]
}

export class ConfigError extends Error {
  problems: string[]
  constructor(problems: string[]) {
    super(`Invalid agent config:\n- ${problems.join("\n- ")}`)
    this.problems = problems
  }
}

// The profile itself, then each profile it inherits from.
export function profileChain(config: Pick<AgentConfig, "profiles">, name: string): string[] {
  const chain: string[] = []
  let current: string | undefined = name
  while (current && !chain.includes(current)) {
    chain.push(current)
    current = config.profiles[current]?.inherits
  }
  return chain
}

const isBudget = (b: unknown): b is Budget =>
  !!b && typeof b === "object" && ["maxToolCalls", "maxSeconds", "maxCostCents"].every((k) => Number.isFinite((b as Record<string, unknown>)[k]))

export function parseConfig(text: string): AgentConfig {
  const raw = parse(text) as Partial<AgentConfig> | null
  const problems: string[] = []
  if (!raw || typeof raw !== "object") throw new ConfigError(["the file is empty or not a YAML mapping"])
  if (raw.version !== 1) problems.push(`version must be 1 (got ${String(raw.version)})`)

  const profiles = raw.profiles ?? {}
  const tools = raw.tools ?? {}
  const requestTypes = raw.requestTypes ?? {}
  const callers = raw.callers ?? []
  if (!Object.keys(profiles).length) problems.push("no profiles defined")

  for (const [name, p] of Object.entries(profiles)) {
    if (p.inherits && !profiles[p.inherits]) problems.push(`profile ${name} inherits unknown profile ${p.inherits}`)
    const chain = profileChain({ profiles }, name)
    const next = profiles[chain[chain.length - 1]]?.inherits
    if (next && chain.includes(next)) problems.push(`profile ${name} inherits in a cycle`)
    for (const t of p.tools ?? []) {
      const def = tools[t]
      if (!def) {
        problems.push(`profile ${name} lists unknown tool ${t}`)
        continue
      }
      // A tool declared for profile P may be offered to P or to profiles that inherit from P, never the other way round.
      if (!chain.includes(def.profile)) problems.push(`tool ${t} is declared for profile ${def.profile} but listed under ${name}`)
    }
  }

  for (const [name, t] of Object.entries(tools)) {
    if (!profiles[t.profile]) problems.push(`tool ${name} has unknown profile ${t.profile}`)
    if (typeof t.enabled !== "boolean") problems.push(`tool ${name}.enabled must be true or false`)
  }

  for (const [name, rt] of Object.entries(requestTypes)) {
    for (const t of rt.tools ?? []) if (!tools[t]) problems.push(`request type ${name} lists unknown tool ${t}`)
    if (!isBudget(rt.budget)) problems.push(`request type ${name} needs a budget with maxToolCalls, maxSeconds, maxCostCents`)
  }

  const ids = new Set<string>()
  for (const c of callers) {
    if (ids.has(c.id)) problems.push(`duplicate caller id ${c.id}`)
    ids.add(c.id)
    if (!profiles[c.profile]) problems.push(`caller ${c.id} has unknown profile ${c.profile}`)
    if (!c.keyHashEnv) problems.push(`caller ${c.id} needs keyHashEnv`)
    if (!isBudget(c.budget)) problems.push(`caller ${c.id} needs a budget`)
    for (const rt of c.allowedRequestTypes ?? []) if (!requestTypes[rt]) problems.push(`caller ${c.id} allows unknown request type ${rt}`)
  }

  if (problems.length) throw new ConfigError(problems)
  return { version: 1, profiles, tools, requestTypes, callers }
}

export function loadConfig(path: string): AgentConfig {
  return parseConfig(readFileSync(path, "utf8"))
}
