// Wire types of the agent service. They move to packages/shared once the grader calls the service.

export type Subject = {
  placeId?: string
  name?: string
  city?: string
  instagram?: string
  clientId?: string
}

export type ResearchRequest = {
  type: string
  subject: Subject
  // "basic" = listing, Instagram and competitors on Instagram (cheap, for anonymous visitors).
  // "full" (default) adds the other networks and the website audit.
  options?: { stream?: boolean; depth?: "basic" | "full" }
}

export type ErrorClass = "rate_limited" | "out_of_credits" | "timeout" | "not_found" | "not_implemented" | "unknown"

export type GapReason =
  | "not_permitted" // the caller's profile does not allow the tool
  | "disabled" // switched off in the config
  | "tool_failed" // the tool ran and failed (see errorClass)
  | "no_data" // the tool ran and found nothing
  | "upstream_missing" // a previous required step produced nothing to work from
  | "budget" // the request budget was used up
  | "depth" // not part of the requested depth (basic)

export type Gap = { fact: string; reason: GapReason; errorClass?: ErrorClass }

export type Evidence = {
  tool: string
  input: unknown
  status: "ok" | "empty" | "error"
  errorClass?: ErrorClass
  source: string
  fetchedAt: string
  durationMs: number
  costCents: number
  cached: boolean
}

export type Confidence = "high" | "medium" | "low"

export type ResearchResult = {
  subject: Subject
  facts: Record<string, unknown>
  gaps: Gap[]
  evidence: Evidence[]
  usage: { toolCalls: number; durationMs: number; costCents: number }
  confidence: Confidence
  needsChoice?: unknown[]
}

export type StepEvent = {
  type: "step"
  id: string
  label: string
  state: "running" | "done" | "skipped" | "error"
  meta?: string
}

export type ResearchEvent = StepEvent | { type: "result"; result: ResearchResult } | { type: "error"; text: string }
