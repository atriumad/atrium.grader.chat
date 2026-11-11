import type { AgentConfig, Budget, CallerConfig, RequestTypeConfig } from "./config.ts"
import { profileChain } from "./config.ts"

export class PolicyError extends Error {
  status: number
  constructor(status: number, message: string) {
    super(message)
    this.status = status
  }
}

export type Access = {
  requestType: RequestTypeConfig
  tools: Set<string> // tools the agent may use in this run
  denied: Map<string, "not_permitted" | "disabled"> // tools the request type wants but this run cannot have
  budget: Budget // the stricter of the caller's and the request type's budget
}

// The one place that decides what a run may touch. The model only ever sees `tools`.
export function resolveAccess(config: AgentConfig, caller: CallerConfig, type: string): Access {
  const requestType = config.requestTypes[type]
  if (!requestType) throw new PolicyError(400, `unknown request type: ${type}`)
  if (requestType.enabled === false || !caller.allowedRequestTypes.includes(type)) {
    throw new PolicyError(403, `request type not available to this caller: ${type}`)
  }

  const profileTools = new Set(profileChain(config, caller.profile).flatMap((p) => config.profiles[p]?.tools ?? []))
  const tools = new Set<string>()
  const denied = new Map<string, "not_permitted" | "disabled">()
  for (const name of requestType.tools) {
    if (!profileTools.has(name)) denied.set(name, "not_permitted")
    else if (!config.tools[name]?.enabled) denied.set(name, "disabled")
    else tools.add(name)
  }

  const budget: Budget = {
    maxToolCalls: Math.min(caller.budget.maxToolCalls, requestType.budget.maxToolCalls),
    maxSeconds: Math.min(caller.budget.maxSeconds, requestType.budget.maxSeconds),
    maxCostCents: Math.min(caller.budget.maxCostCents, requestType.budget.maxCostCents),
  }
  return { requestType, tools, denied, budget }
}

export function requiresClientId(config: AgentConfig, caller: CallerConfig): boolean {
  return profileChain(config, caller.profile).some((p) => config.profiles[p]?.requireClientId)
}
