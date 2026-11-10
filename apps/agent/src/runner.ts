import type { AgentConfig, CallerConfig } from "./config.ts"
import { PolicyError, requiresClientId, resolveAccess } from "./policy.ts"
import type { Registry, ToolResult } from "./tools/types.ts"
import { failure } from "./tools/types.ts"
import type { Confidence, Evidence, Gap, GapReason, ResearchEvent, ResearchRequest, ResearchResult, Subject } from "./types.ts"

export type RunDeps = { config: AgentConfig; registry: Registry; now?: () => number }
export type Emit = (event: ResearchEvent) => void

const MAX_COMPETITOR_SOCIAL = 3

type Outcome = { kind: "ran"; result: ToolResult } | { kind: "skipped"; reason: GapReason }
type Place = { id?: string; name?: string; address?: string; website?: string | null }

const asRecord = (v: unknown): Record<string, unknown> => (v && typeof v === "object" ? (v as Record<string, unknown>) : {})

// `business_profile` as a fixed sequence: the same lookups, in the same order, as the grader runs today.
// The model-driven loop will replace the sequence later behind the same input and output.
export async function runResearch(deps: RunDeps, caller: CallerConfig, request: ResearchRequest, emit: Emit): Promise<ResearchResult> {
  const { config, registry } = deps
  const now = deps.now ?? Date.now
  const access = resolveAccess(config, caller, request.type)
  if (request.type !== "business_profile") throw new PolicyError(501, `request type not implemented yet: ${request.type}`)
  if (requiresClientId(config, caller) && !request.subject.clientId) throw new PolicyError(400, "subject.clientId is required for this caller")

  const startedAt = now()
  const evidence: Evidence[] = []
  const gaps: Gap[] = []
  const facts: Record<string, unknown> = {}
  // Holds the promise, so an identical call made while the first is still running shares it.
  const cache = new Map<string, Promise<ToolResult>>()
  let toolCalls = 0
  let costCents = 0

  const budgetLeft = (estimate: number): boolean =>
    toolCalls < access.budget.maxToolCalls &&
    now() - startedAt < access.budget.maxSeconds * 1000 &&
    costCents + estimate <= access.budget.maxCostCents

  // Runs one tool under the run's rules: permission, budget, cache, timeout, evidence, progress event.
  async function call(tool: string, input: Record<string, unknown>, id: string, label: string): Promise<Outcome> {
    const denied = access.denied.get(tool)
    if (denied || !access.tools.has(tool)) {
      emit({ type: "step", id, label, state: "skipped", meta: denied === "disabled" ? "desactivada" : "no disponible" })
      return { kind: "skipped", reason: denied ?? "not_permitted" }
    }
    const def = registry.get(tool)
    const cfg = config.tools[tool]
    const estimate = cfg?.costCentsEstimate ?? 0
    const key = `${tool}:${JSON.stringify(input)}`

    const shared = cache.get(key)
    if (shared) {
      const hit = await shared
      evidence.push({ tool, input, status: hit.status, errorClass: hit.errorClass, source: hit.source, fetchedAt: hit.fetchedAt, durationMs: 0, costCents: 0, cached: true })
      emit({ type: "step", id, label, state: hit.status === "error" ? "error" : "done", meta: def?.summarize?.(hit) ?? hit.errorClass ?? hit.status })
      return { kind: "ran", result: hit }
    }
    if (!budgetLeft(estimate)) {
      emit({ type: "step", id, label, state: "skipped", meta: "presupuesto agotado" })
      return { kind: "skipped", reason: "budget" }
    }

    // Reserve the call and its estimated cost now: calls run in parallel, so the check above must see them.
    toolCalls++
    costCents += estimate
    emit({ type: "step", id, label, state: "running" })
    const t0 = now()
    const execute = async (): Promise<ToolResult> => {
      const controller = new AbortController()
      let timer: NodeJS.Timeout | undefined
      try {
        if (!def) throw new Error(`tool not registered: ${tool}`)
        const timeout = new Promise<ToolResult>((resolve) => {
          timer = setTimeout(() => {
            controller.abort()
            resolve(failure("timeout"))
          }, (cfg?.timeoutSeconds ?? 30) * 1000)
        })
        return await Promise.race([def.run(input, { signal: controller.signal, clientId: request.subject.clientId }), timeout])
      } catch {
        return failure("unknown")
      } finally {
        clearTimeout(timer)
      }
    }
    const running = execute()
    cache.set(key, running)
    const result = await running
    if (result.status === "error") cache.delete(key) // failures are not reused
    const cost = result.costCents ?? estimate
    costCents += cost - estimate // settle the reservation with the real cost
    evidence.push({ tool, input, status: result.status, errorClass: result.errorClass, source: result.source, fetchedAt: result.fetchedAt, durationMs: now() - t0, costCents: cost, cached: false })
    emit({ type: "step", id, label, state: result.status === "error" ? "error" : "done", meta: def?.summarize?.(result) ?? result.errorClass ?? result.status })
    return { kind: "ran", result }
  }

  // Records why a fact is missing, or returns its data when the tool produced some.
  function take(fact: string, outcome: Outcome): unknown | undefined {
    if (outcome.kind === "skipped") {
      gaps.push({ fact, reason: outcome.reason })
      return undefined
    }
    const { result } = outcome
    if (result.status === "error") gaps.push({ fact, reason: "tool_failed", errorClass: result.errorClass })
    else if (result.status === "empty") gaps.push({ fact, reason: "no_data" })
    else return result.data
    return undefined
  }

  const subject: Subject = request.subject
  const finish = (extra?: Partial<ResearchResult>): ResearchResult => {
    const required = access.requestType.required
    const missing = required.some((f) => gaps.some((g) => g.fact === f))
    const optional = access.requestType.optional
    const confidence: Confidence = missing ? "low" : optional.some((f) => gaps.some((g) => g.fact === f)) ? "medium" : "high"
    return { subject, facts, gaps, evidence, usage: { toolCalls, durationMs: now() - startedAt, costCents }, confidence, ...extra }
  }

  // 1. Identify the business.
  const listingInput = subject.placeId ? { placeId: subject.placeId } : { name: subject.name, city: subject.city }
  const listing = take("listing", await call("google_listing", listingInput, "google", "Leyendo la ficha pública"))
  const listingData = asRecord(listing)
  if (Array.isArray(listingData.needsChoice)) return finish({ needsChoice: listingData.needsChoice })
  if (!listing) {
    for (const fact of ["social", "competitors", "competitorSocial"]) gaps.push({ fact, reason: "upstream_missing" })
    return finish()
  }
  facts.listing = listing
  const place = listingData as Place

  // 2. Business social, competitors and website, independent of each other.
  const [social, competitors, website] = await Promise.all([
    call("social_public", { name: place.name, address: place.address, website: place.website }, "social", "Leyendo las redes del negocio"),
    call("find_competitors", { placeId: place.id }, "competitors", "Buscando competidores cercanos"),
    place.website ? call("website_audit", { url: place.website }, "website", "Revisando el sitio web") : Promise.resolve<Outcome>({ kind: "skipped", reason: "no_data" }),
  ])
  const socialData = take("social", social)
  if (socialData) facts.social = socialData
  const websiteData = take("websiteAudit", website)
  if (websiteData) facts.websiteAudit = websiteData

  // Optional facts with no tool in this version are reported, not hidden.
  for (const [fact, tool] of [["reviewSignals", "reviews_signals"], ["searchDemand", "search_demand"]] as const) {
    if (access.requestType.optional.includes(fact)) {
      const why = access.denied.get(tool) ?? "disabled"
      gaps.push({ fact, reason: access.tools.has(tool) ? "disabled" : why })
    }
  }

  // 3. Competitors' social, up to MAX_COMPETITOR_SOCIAL.
  const list = asRecord(take("competitors", competitors)).competitors
  const rivals = Array.isArray(list) ? (list as Place[]) : []
  if (!rivals.length) {
    if (!gaps.some((g) => g.fact === "competitors")) gaps.push({ fact: "competitors", reason: "no_data" })
    gaps.push({ fact: "competitorSocial", reason: "upstream_missing" })
    return finish()
  }
  facts.competitors = rivals
  const rivalSocial = await Promise.all(
    rivals.slice(0, MAX_COMPETITOR_SOCIAL).map(async (r, i) => ({
      name: r.name,
      outcome: await call("social_public", { name: r.name, address: r.address, website: r.website }, `rival-${i}`, `Leyendo las redes de ${r.name ?? "un competidor"}`),
    }))
  )
  const read = rivalSocial.flatMap((r) => {
    const data = r.outcome.kind === "ran" && r.outcome.result.status === "ok" ? r.outcome.result.data : undefined
    return data ? [{ name: r.name, social: data }] : []
  })
  if (read.length) facts.competitorSocial = read
  else {
    const first = rivalSocial[0]?.outcome
    gaps.push(first?.kind === "ran" && first.result.status === "error" ? { fact: "competitorSocial", reason: "tool_failed", errorClass: first.result.errorClass } : { fact: "competitorSocial", reason: first?.kind === "skipped" ? first.reason : "no_data" })
  }

  return finish()
}
