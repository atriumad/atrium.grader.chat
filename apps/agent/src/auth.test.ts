import assert from "node:assert/strict"
import { test } from "node:test"
import { authenticate, hashKey } from "./auth.ts"
import { testConfig } from "./testing.ts"

const config = testConfig()
const env = { K_GRADER: hashKey("grader-key"), K_ATRIUM: hashKey("atrium-key"), K_OFF: hashKey("off-key") }

test("a valid key identifies its caller", () => {
  assert.equal(authenticate(config, "Bearer grader-key", env)?.id, "grader")
  assert.equal(authenticate(config, "bearer atrium-key", env)?.id, "atrium")
})

test("missing, malformed, wrong and inactive keys are rejected", () => {
  assert.equal(authenticate(config, undefined, env), null)
  assert.equal(authenticate(config, "grader-key", env), null)
  assert.equal(authenticate(config, "Bearer nope", env), null)
  assert.equal(authenticate(config, "Bearer off-key", env), null) // caller exists but is inactive
})

test("a caller whose hash is not configured cannot authenticate", () => {
  assert.equal(authenticate(config, "Bearer grader-key", { K_ATRIUM: env.K_ATRIUM }), null)
  assert.equal(authenticate(config, "Bearer grader-key", { K_GRADER: "not-a-hash" }), null)
})

test("the raw key is never what is compared", () => {
  assert.equal(authenticate(config, "Bearer " + env.K_GRADER, env), null) // presenting the hash does not work
})
