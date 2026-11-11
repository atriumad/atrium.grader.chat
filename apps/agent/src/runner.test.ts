import assert from "node:assert/strict"
import { test } from "node:test"
import { runResearch } from "./runner.ts"
import { createRegistry, failure } from "./tools/types.ts"
import type { ResearchEvent } from "./types.ts"
import { happyTools, ok, testConfig, tool } from "./testing.ts"

const config = testConfig()
const grader = config.callers.find((c) => c.id === "grader")!
const atrium = config.callers.find((c) => c.id === "atrium")!
const req = { type: "business_profile", subject: { name: "Biz", city: "Town" } }

test("happy path returns every required fact, evidence for every call, and no required gaps", async () => {
  const calls: string[] = []
  const events: ResearchEvent[] = []
  const r = await runResearch({ config, registry: createRegistry(happyTools(calls)) }, grader, req, (e) => events.push(e))
  assert.ok(r.facts.listing && r.facts.social && r.facts.competitors && r.facts.competitorSocial)
  assert.equal((r.facts.competitorSocial as unknown[]).length, 3) // capped at 3 of 4 competitors
  assert.equal(r.evidence.length, 6) // listing, competitors, business social, 3 rival socials
  assert.equal(r.usage.toolCalls, 6)
  assert.equal(r.usage.costCents, 1 + 3 + 4 * 4)
  assert.ok(!r.gaps.some((g) => ["listing", "social", "competitors", "competitorSocial"].includes(g.fact)))
  assert.equal(r.confidence, "medium") // optional website audit is disabled
  assert.ok(r.gaps.some((g) => g.fact === "websiteAudit" && g.reason === "disabled"))
  assert.ok(events.some((e) => e.type === "step" && e.id === "google" && e.state === "running"))
  assert.ok(events.some((e) => e.type === "step" && e.id === "rival-2" && e.state === "done"))
})

test("a failing provider becomes a gap with its cause, never an empty success", async () => {
  const tools = happyTools().map((t) => (t.name === "social_public" ? tool("social_public", async () => failure("out_of_credits")) : t))
  const r = await runResearch({ config, registry: createRegistry(tools) }, grader, req, () => {})
  const social = r.gaps.find((g) => g.fact === "social")
  assert.deepEqual(social, { fact: "social", reason: "tool_failed", errorClass: "out_of_credits" })
  assert.equal(r.facts.social, undefined)
  assert.equal(r.confidence, "low")
  assert.ok(r.evidence.every((e) => e.tool !== "social_public" || e.status === "error"))
})

test("a throwing tool is contained as an unknown failure", async () => {
  const tools = happyTools().map((t) => (t.name === "find_competitors" ? tool("find_competitors", async () => { throw new Error("boom") }) : t))
  const r = await runResearch({ config, registry: createRegistry(tools) }, grader, req, () => {})
  assert.deepEqual(r.gaps.find((g) => g.fact === "competitors"), { fact: "competitors", reason: "tool_failed", errorClass: "unknown" })
  assert.ok(r.gaps.some((g) => g.fact === "competitorSocial" && g.reason === "upstream_missing"))
})

test("a tool that hangs is cut off at its timeout", async () => {
  const tools = happyTools().map((t) => (t.name === "google_listing" ? tool("google_listing", () => new Promise(() => {})) : t))
  const r = await runResearch({ config, registry: createRegistry(tools) }, grader, req, () => {})
  assert.deepEqual(r.gaps[0], { fact: "listing", reason: "tool_failed", errorClass: "timeout" })
  assert.ok(r.gaps.some((g) => g.fact === "social" && g.reason === "upstream_missing"))
})

test("when the listing is ambiguous the run stops and returns the options", async () => {
  const options = [{ id: "a" }, { id: "b" }]
  const tools = happyTools().map((t) => (t.name === "google_listing" ? tool("google_listing", async () => ok({ needsChoice: options })) : t))
  const calls: string[] = []
  const r = await runResearch({ config, registry: createRegistry([...tools, tool("spy", async () => ok(1))]) }, grader, req, (e) => calls.push(e.type))
  assert.deepEqual(r.needsChoice, options)
  assert.equal(r.evidence.length, 1) // nothing else was called
})

test("the call budget stops the run and reports the rest as gaps", async () => {
  const tight = structuredClone(config)
  tight.callers[0].budget.maxToolCalls = 3
  const r = await runResearch({ config: tight, registry: createRegistry(happyTools()) }, tight.callers[0], req, () => {})
  assert.equal(r.usage.toolCalls, 3)
  assert.ok(r.gaps.some((g) => g.reason === "budget"))
  assert.equal(r.confidence, "low")
})

test("the cost budget is enforced before a call, not after", async () => {
  const tight = structuredClone(config)
  tight.callers[0].budget.maxCostCents = 5 // listing (1) + competitors (3) fit; the next social (4) does not
  const r = await runResearch({ config: tight, registry: createRegistry(happyTools()) }, tight.callers[0], req, () => {})
  assert.ok(r.usage.costCents <= 5)
  assert.ok(r.gaps.some((g) => g.reason === "budget"))
})

test("an identical call is served from cache and costs nothing", async () => {
  const dupe = [{ name: "A", address: "1 St", website: "https://a.test" }, { name: "A", address: "1 St", website: "https://a.test" }]
  const tools = happyTools().map((t) => (t.name === "find_competitors" ? tool("find_competitors", async () => ok({ competitors: dupe })) : t))
  const r = await runResearch({ config, registry: createRegistry(tools) }, grader, req, () => {})
  const cached = r.evidence.filter((e) => e.cached)
  assert.equal(cached.length, 1)
  assert.equal(cached[0].costCents, 0)
})

test("an unregistered tool is a contained failure, not a crash", async () => {
  const r = await runResearch({ config, registry: createRegistry([]) }, grader, req, () => {})
  assert.equal(r.gaps[0].reason, "tool_failed")
})

test("the internal profile must name a client", async () => {
  await assert.rejects(runResearch({ config, registry: createRegistry(happyTools()) }, atrium, req, () => {}), /clientId/)
  const r = await runResearch({ config, registry: createRegistry(happyTools()) }, atrium, { ...req, subject: { ...req.subject, clientId: "c1" } }, () => {})
  assert.ok(r.facts.listing)
})

test("rival locations sharing accounts fold into one brand and do not use up the slots", async () => {
  const many = ["A1", "A2", "B", "Biz2", "C", "D"].map((name) => ({ name, address: `${name} St`, website: `https://${name}.test` }))
  const handles: Record<string, string> = { A1: "brand_a", A2: "brand_a", B: "brand_b", Biz2: "biz", C: "brand_c", D: "brand_d" }
  const tools = happyTools().map((t) => {
    if (t.name === "find_competitors") return tool("find_competitors", async () => ok({ competitors: many }))
    if (t.name === "social_public") return tool("social_public", async (i) => ok({ instagram: { handle: i.name === "Biz" ? "biz" : handles[String(i.name)] }, networks: [] }))
    return t
  })
  const r = await runResearch({ config, registry: createRegistry(tools) }, grader, req, () => {})
  const social = r.facts.competitorSocial as { name: string }[]
  assert.deepEqual(social.map((s) => s.name), ["A1 · 2 locations", "B", "C"]) // Biz2 is the business itself, A2 folded into A1
  assert.deepEqual(r.facts.competitorGrouping, { merged: 1, sameBrandAsBusiness: 1 })
})

test("website_audit runs inside the subject's host only", async () => {
  const on = structuredClone(config)
  on.tools.website_audit = { ...on.tools.website_audit, enabled: true, timeoutSeconds: 1, costCentsEstimate: 2 }
  let seen: string[] | undefined
  const tools = [...happyTools(), tool("website_audit", async (_i, ctx) => ((seen = ctx.subjectHosts), ok({ url: "https://biz.test" })))]
  const r = await runResearch({ config: on, registry: createRegistry(tools) }, on.callers[0], req, () => {})
  assert.deepEqual(seen, ["biz.test"])
  assert.ok(r.facts.websiteAudit)
})

test("a provider that is out of credits stops the rival rounds instead of failing every rival", async () => {
  const many = ["A", "B", "C", "D", "E", "F"].map((name) => ({ name, address: `${name} St`, website: `https://${name}.test` }))
  let socialCalls = 0
  const tools = happyTools().map((t) => {
    if (t.name === "find_competitors") return tool("find_competitors", async () => ok({ competitors: many }))
    if (t.name === "social_public") return tool("social_public", async () => (socialCalls++, failure("out_of_credits")))
    return t
  })
  const r = await runResearch({ config, registry: createRegistry(tools) }, grader, req, () => {})
  assert.equal(socialCalls, 1 + 3) // the business plus one round of 3 rivals, no more
  assert.ok(r.gaps.some((g) => g.fact === "competitorSocial" && g.errorClass === "out_of_credits"))
})

test("competitors are read for Instagram only; the business gets every network", async () => {
  const seen: { name?: unknown; instagramOnly?: unknown }[] = []
  const tools = happyTools().map((t) => (t.name === "social_public" ? tool("social_public", async (i) => (seen.push({ name: i.name, instagramOnly: i.instagramOnly }), ok({ instagram: { handle: String(i.name) }, networks: [] }))) : t))
  await runResearch({ config, registry: createRegistry(tools) }, grader, req, () => {})
  assert.equal(seen.find((s) => s.name === "Biz")?.instagramOnly, false)
  assert.ok(seen.filter((s) => s.name !== "Biz").length >= 3)
  assert.ok(seen.filter((s) => s.name !== "Biz").every((s) => s.instagramOnly === true))
})

test("basic depth reads Instagram only for the business and skips the website audit", async () => {
  const on = structuredClone(config)
  on.tools.website_audit = { ...on.tools.website_audit, enabled: true, timeoutSeconds: 1, costCentsEstimate: 2 }
  const seen: { name?: unknown; instagramOnly?: unknown }[] = []
  let audits = 0
  const tools = [
    ...happyTools().filter((t) => t.name !== "social_public"),
    tool("social_public", async (i) => (seen.push({ name: i.name, instagramOnly: i.instagramOnly }), ok({ instagram: { handle: String(i.name) }, networks: [] }))),
    tool("website_audit", async () => (audits++, ok({ url: "x" }))),
  ]
  const basic = await runResearch({ config: on, registry: createRegistry(tools) }, on.callers[0], { ...req, options: { depth: "basic" } }, () => {})
  assert.equal(audits, 0)
  assert.ok(seen.every((s) => s.instagramOnly === true))
  assert.ok(basic.gaps.some((g) => g.fact === "websiteAudit" && g.reason === "depth"))
  seen.length = 0
  await runResearch({ config: on, registry: createRegistry(tools) }, on.callers[0], req, () => {})
  assert.equal(audits, 1)
  assert.equal(seen.find((s) => s.name === "Biz")?.instagramOnly, false)
})
