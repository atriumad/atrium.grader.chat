import { parseConfig } from "./config.ts"
import type { ToolDef, ToolResult } from "./tools/types.ts"

export const CONFIG_YAML = `
version: 1
profiles:
  public: { tools: [google_listing, find_competitors, social_public, website_audit, reviews_signals], privateData: false }
  internal: { inherits: public, tools: [metricool_metrics], privateData: true, requireClientId: true }
tools:
  google_listing: { enabled: true, profile: public, timeoutSeconds: 1, costCentsEstimate: 1 }
  find_competitors: { enabled: true, profile: public, timeoutSeconds: 1, costCentsEstimate: 3 }
  social_public: { enabled: true, profile: public, timeoutSeconds: 1, costCentsEstimate: 4 }
  website_audit: { enabled: false, profile: public }
  reviews_signals: { enabled: false, profile: public }
  metricool_metrics: { enabled: true, profile: internal, costCentsEstimate: 0 }
requestTypes:
  business_profile:
    tools: [google_listing, find_competitors, social_public, website_audit, reviews_signals]
    required: [listing, social, competitors, competitorSocial]
    optional: [websiteAudit, reviewSignals]
    budget: { maxToolCalls: 12, maxSeconds: 90, maxCostCents: 30 }
  client_performance:
    tools: [google_listing, metricool_metrics]
    required: [listing, privateMetrics]
    optional: []
    budget: { maxToolCalls: 10, maxSeconds: 60, maxCostCents: 20 }
callers:
  - { id: grader, name: Grader, profile: public, keyHashEnv: K_GRADER, allowedRequestTypes: [business_profile], budget: { maxToolCalls: 12, maxSeconds: 90, maxCostCents: 30 }, active: true }
  - { id: atrium, name: Atrium, profile: internal, keyHashEnv: K_ATRIUM, allowedRequestTypes: [business_profile, client_performance], budget: { maxToolCalls: 10, maxSeconds: 60, maxCostCents: 20 }, active: true }
  - { id: off, name: Off, profile: public, keyHashEnv: K_OFF, allowedRequestTypes: [business_profile], budget: { maxToolCalls: 1, maxSeconds: 1, maxCostCents: 1 }, active: false }
`

export const testConfig = () => parseConfig(CONFIG_YAML)

export const ok = (data: unknown): ToolResult => ({ status: "ok", data, source: "test", fetchedAt: "2026-01-01T00:00:00.000Z" })
export const tool = (name: string, run: ToolDef["run"]): ToolDef => ({ name, run })

export const rivals = [
  { name: "A", address: "1 St", website: "https://a.test" },
  { name: "B", address: "2 St", website: "https://b.test" },
  { name: "C", address: "3 St", website: "https://c.test" },
  { name: "D", address: "4 St", website: "https://d.test" },
]

// A working set of fake tools: one listing, four competitors, a social profile for anyone.
export const happyTools = (calls: string[] = []): ToolDef[] => [
  tool("google_listing", async () => (calls.push("google_listing"), ok({ id: "p1", name: "Biz", address: "9 Main St", website: "https://biz.test" }))),
  tool("find_competitors", async () => (calls.push("find_competitors"), ok({ competitors: rivals }))),
  tool("social_public", async (i) => (calls.push(`social_public:${String(i.name)}`), ok({ handle: `@${String(i.name).toLowerCase()}` }))),
]
