// Pure (client-safe) agent config: types, defaults and sanitizer.

export type AgentConfig = {
  tone: "cercano" | "formal" | "directo"
  chatInstructions: string // extra rules for the chat agent
  analysisInstructions: string // extra rules for the written analysis
  maxToolRounds: number
  tools: {
    liveSocial: boolean
    liveGoogle: boolean
    seo: boolean
    ranking: boolean
    knowledge: boolean
    booking: boolean
  }
}

export const DEFAULT_AGENT_CONFIG: AgentConfig = {
  tone: "cercano",
  chatInstructions: "",
  analysisInstructions: "",
  maxToolRounds: 8,
  tools: { liveSocial: true, liveGoogle: true, seo: true, ranking: true, knowledge: true, booking: true },
}

const str = (v: unknown, max: number) => (typeof v === "string" ? v.trim().slice(0, max) : "")
const bool = (v: unknown, d: boolean) => (typeof v === "boolean" ? v : d)

export function sanitizeAgentConfig(input: unknown): AgentConfig {
  const r = (input && typeof input === "object" ? input : {}) as Record<string, unknown>
  const t = (r.tools && typeof r.tools === "object" ? r.tools : {}) as Record<string, unknown>
  const d = DEFAULT_AGENT_CONFIG
  const rounds = Number(r.maxToolRounds)
  return {
    tone: r.tone === "formal" || r.tone === "directo" || r.tone === "cercano" ? r.tone : d.tone,
    chatInstructions: str(r.chatInstructions, 4000),
    analysisInstructions: str(r.analysisInstructions, 4000),
    maxToolRounds: Number.isInteger(rounds) ? Math.min(12, Math.max(2, rounds)) : d.maxToolRounds,
    tools: {
      liveSocial: bool(t.liveSocial, d.tools.liveSocial),
      liveGoogle: bool(t.liveGoogle, d.tools.liveGoogle),
      seo: bool(t.seo, d.tools.seo),
      ranking: bool(t.ranking, d.tools.ranking),
      knowledge: bool(t.knowledge, d.tools.knowledge),
      booking: bool(t.booking, d.tools.booking),
    },
  }
}
