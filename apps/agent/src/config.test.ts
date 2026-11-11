import assert from "node:assert/strict"
import { test } from "node:test"
import { dirname, join } from "node:path"
import { fileURLToPath } from "node:url"
import { ConfigError, loadConfig, parseConfig } from "./config.ts"
import { CONFIG_YAML } from "./testing.ts"

test("the shipped agent.config.yaml is valid", () => {
  const config = loadConfig(join(dirname(fileURLToPath(import.meta.url)), "..", "agent.config.yaml"))
  assert.ok(config.requestTypes.business_profile)
  assert.ok(config.callers.some((c) => c.id === "grader-web"))
})

test("a public profile cannot list a tool declared for internal", () => {
  const bad = CONFIG_YAML.replace("public: { tools: [google_listing,", "public: { tools: [metricool_metrics, google_listing,")
  assert.throws(() => parseConfig(bad), (e) => e instanceof ConfigError && e.problems.some((p) => p.includes("metricool_metrics") && p.includes("internal")))
})

test("unknown references are reported together", () => {
  const bad = CONFIG_YAML.replace("allowedRequestTypes: [business_profile], budget: { maxToolCalls: 12", "allowedRequestTypes: [nope], budget: { maxToolCalls: 12").replace("profile: public, timeoutSeconds: 1, costCentsEstimate: 3", "profile: ghost, timeoutSeconds: 1, costCentsEstimate: 3")
  assert.throws(() => parseConfig(bad), (e) => e instanceof ConfigError && e.problems.length >= 2)
})

test("inheritance cycles are rejected", () => {
  const bad = CONFIG_YAML.replace("public: { tools: [google_listing,", "public: { inherits: internal, tools: [google_listing,")
  assert.throws(() => parseConfig(bad), (e) => e instanceof ConfigError && e.problems.some((p) => p.includes("cycle")))
})
