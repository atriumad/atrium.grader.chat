import assert from "node:assert/strict"
import { test } from "node:test"
import { PolicyError, resolveAccess } from "./policy.ts"
import { testConfig } from "./testing.ts"

const config = testConfig()
const caller = (id: string) => config.callers.find((c) => c.id === id)!

test("the public profile gets only enabled public tools", () => {
  const a = resolveAccess(config, caller("grader"), "business_profile")
  assert.deepEqual([...a.tools].sort(), ["find_competitors", "google_listing", "social_public"])
  assert.equal(a.denied.get("website_audit"), "disabled")
})

test("a public caller can never reach a private tool, even through a request type that lists it", () => {
  const cfg = structuredClone(config)
  cfg.requestTypes.business_profile.tools.push("metricool_metrics")
  const a = resolveAccess(cfg, caller("grader"), "business_profile")
  assert.equal(a.tools.has("metricool_metrics"), false)
  assert.equal(a.denied.get("metricool_metrics"), "not_permitted")
})

test("a public caller cannot use a request type it is not allowed", () => {
  assert.throws(() => resolveAccess(config, caller("grader"), "client_performance"), (e) => e instanceof PolicyError && e.status === 403)
})

test("the internal profile inherits the public tools and adds its own", () => {
  const a = resolveAccess(config, caller("atrium"), "client_performance")
  assert.ok(a.tools.has("google_listing") && a.tools.has("metricool_metrics"))
})

test("unknown request types are a 400", () => {
  assert.throws(() => resolveAccess(config, caller("grader"), "nope"), (e) => e instanceof PolicyError && e.status === 400)
})

test("the budget is the stricter of caller and request type", () => {
  assert.deepEqual(resolveAccess(config, caller("atrium"), "business_profile").budget, { maxToolCalls: 10, maxSeconds: 60, maxCostCents: 20 })
  assert.deepEqual(resolveAccess(config, caller("grader"), "business_profile").budget, { maxToolCalls: 12, maxSeconds: 90, maxCostCents: 30 })
})
