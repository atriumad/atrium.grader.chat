// Client of the research agent service (apps/agent). The grader uses it behind ANALYZE_VIA_AGENT=1
// and falls back to its own lookups whenever the service is off, unreachable, or cannot decide.

import type { Dataset } from "@/lib/analysis"
import type { Grouped } from "@/lib/competitors"
import { groupNote } from "@/lib/competitors"

type Entity = Dataset["business"]

export const agentEnabled = (): boolean => process.env.ANALYZE_VIA_AGENT === "1" && !!process.env.AGENT_URL && !!process.env.AGENT_API_KEY

export type AgentStep = { id: string; label: string; state: "running" | "done" | "skipped" | "error"; meta?: string }

export type AgentResearch = {
  business: Entity
  competitors: Entity[]
  note: string // grouping note for competitorsSource
  confidence: string
  gaps: { fact: string; reason: string; errorClass?: string }[]
}

type AgentResult = {
  facts: Record<string, unknown>
  gaps: AgentResearch["gaps"]
  confidence: string
  needsChoice?: unknown[]
}

const rec = (v: unknown): Record<string, unknown> => (v && typeof v === "object" ? (v as Record<string, unknown>) : {})

// Pure: turns the agent's facts into the entities the grader scores and writes about.
// Returns null when the business itself could not be identified (the caller falls back).
export function toEntities(result: AgentResult): AgentResearch | null {
  if (result.needsChoice || !result.facts.listing) return null
  const place = result.facts.listing as Entity["place"]
  const social = rec(result.facts.social)
  const socialGap = result.gaps.find((g) => g.fact === "social")
  const business: Entity = {
    name: place?.name ?? "",
    place,
    instagram: (social.instagram ?? null) as Entity["instagram"],
    instagramNote: typeof social.instagramNote === "string" ? social.instagramNote : socialGap ? `No disponible: ${socialGap.errorClass ?? socialGap.reason}` : "No encontrado",
    networks: (social.networks ?? []) as Entity["networks"],
    networksNote: typeof social.networksNote === "string" ? social.networksNote : undefined,
  }

  const read = Array.isArray(result.facts.competitorSocial) ? (result.facts.competitorSocial as unknown[]).map(rec) : []
  const readIds = new Set((Array.isArray(result.facts.competitorsRead) ? result.facts.competitorsRead : []) as string[])
  const analyzed: Entity[] = read.map((r) => {
    const s = rec(r.social)
    return {
      name: String(r.name ?? ""),
      place: (r.place ?? null) as Entity["place"],
      instagram: (s.instagram ?? null) as Entity["instagram"],
      instagramNote: typeof s.instagramNote === "string" ? s.instagramNote : "ok",
      networks: (s.networks ?? []) as Entity["networks"],
      networksNote: typeof s.networksNote === "string" ? s.networksNote : undefined,
    }
  })
  const all = Array.isArray(result.facts.competitors) ? (result.facts.competitors as NonNullable<Entity["place"]>[]) : []
  const rest: Entity[] = all.filter((p) => !readIds.has(p.id)).map((p) => ({ name: p.name, place: p, instagram: null, instagramNote: "Not analyzed" }))

  const g = rec(result.facts.competitorGrouping)
  const grouped: Grouped = { competitors: [], merged: Number(g.merged ?? 0), sameBrandAsBusiness: Number(g.sameBrandAsBusiness ?? 0) }
  return { business, competitors: [...analyzed, ...rest], note: groupNote(grouped), confidence: result.confidence, gaps: result.gaps }
}

// Runs one research request. Returns null on any problem so the caller can use its own flow.
export async function researchViaAgent(
  subject: { placeId?: string; name?: string },
  onStep: (s: AgentStep) => void,
  depth: "basic" | "full" = "full"
): Promise<AgentResearch | null> {
  try {
    const res = await fetch(`${process.env.AGENT_URL!.replace(/\/$/, "")}/v1/research`, {
      method: "POST",
      headers: { "Content-Type": "application/json", Authorization: `Bearer ${process.env.AGENT_API_KEY}` },
      body: JSON.stringify({ type: "business_profile", subject, options: { stream: true, depth } }),
      signal: AbortSignal.timeout(100_000),
    })
    if (!res.ok || !res.body) return null
    const reader = res.body.getReader()
    const decoder = new TextDecoder()
    let buffer = ""
    let result: AgentResult | null = null
    const handle = (line: string) => {
      if (!line.trim()) return
      const e = JSON.parse(line) as { type: string; result?: AgentResult } & Partial<AgentStep>
      if (e.type === "step") onStep(e as AgentStep)
      else if (e.type === "result" && e.result) result = e.result
    }
    for (;;) {
      const { done, value } = await reader.read()
      if (done) break
      buffer += decoder.decode(value, { stream: true })
      const lines = buffer.split("\n")
      buffer = lines.pop() ?? ""
      lines.forEach(handle)
    }
    handle(buffer)
    return result ? toEntities(result) : null
  } catch {
    return null
  }
}
