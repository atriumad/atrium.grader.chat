import assert from "node:assert/strict"
import { after, before, test } from "node:test"
import type { Server } from "node:http"
import type { AddressInfo } from "node:net"
import { hashKey } from "./auth.ts"
import { createAgentServer } from "./server.ts"
import { createRegistry } from "./tools/types.ts"
import { happyTools, testConfig } from "./testing.ts"

let server: Server
let base = ""
const env = { K_GRADER: hashKey("grader-key"), K_ATRIUM: hashKey("atrium-key") }
const post = (body: unknown, key: string | null = "grader-key") =>
  fetch(`${base}/v1/research`, { method: "POST", headers: { "Content-Type": "application/json", ...(key ? { Authorization: `Bearer ${key}` } : {}) }, body: JSON.stringify(body) })
type Json = { facts: Record<string, unknown>; subject: object }
const good = { type: "business_profile", subject: { name: "Biz", city: "Town" } }

before(async () => {
  server = createAgentServer({ config: testConfig(), registry: createRegistry(happyTools()), env })
  await new Promise<void>((r) => server.listen(0, r))
  base = `http://127.0.0.1:${(server.address() as AddressInfo).port}`
})
after(() => server.close())

test("no key or a wrong key is a 401", async () => {
  assert.equal((await post(good, null)).status, 401)
  assert.equal((await post(good, "wrong")).status, 401)
})

test("streams NDJSON steps and ends with the result", async () => {
  const res = await post(good)
  assert.equal(res.status, 200)
  assert.match(res.headers.get("content-type") ?? "", /ndjson/)
  const lines = (await res.text()).trim().split("\n").map((l) => JSON.parse(l))
  assert.ok(lines.some((l) => l.type === "step"))
  assert.equal(lines.at(-1).type, "result")
  assert.ok(lines.at(-1).result.facts.listing)
})

test("stream:false returns a single JSON result", async () => {
  const res = await post({ ...good, options: { stream: false } })
  assert.equal(res.status, 200)
  assert.ok(((await res.json()) as Json).facts.listing)
})

test("policy errors keep their own status (public caller asking for an internal request type)", async () => {
  assert.equal((await post({ type: "client_performance", subject: { clientId: "c1" } })).status, 403)
})

test("bad input is a 400, and unknown fields are ignored", async () => {
  assert.equal((await post({ subject: {} })).status, 400)
  assert.equal((await post({ type: "business_profile", subject: {} })).status, 400)
  const res = await post({ ...good, subject: { ...good.subject, evil: "x", clientId: undefined }, options: { stream: false } })
  assert.equal(res.status, 200)
  assert.equal("evil" in ((await res.json()) as Json).subject, false)
})

test("the internal caller is refused without a clientId", async () => {
  assert.equal((await post(good, "atrium-key")).status, 400)
})

test("health check needs no key; unknown paths are 404", async () => {
  assert.equal((await fetch(`${base}/healthz`)).status, 200)
  assert.equal((await fetch(`${base}/nope`)).status, 404)
})
