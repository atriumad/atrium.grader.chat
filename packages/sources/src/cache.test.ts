import assert from "node:assert/strict"
import { afterEach, beforeEach, test } from "node:test"
import { cached, clearMemoryCache, setSharedCache, socialTtl } from "./cache.ts"

beforeEach(() => { clearMemoryCache(); setSharedCache(null); delete process.env.SOCIAL_CACHE_DAYS })
afterEach(() => { setSharedCache(null) })

test("a second call is served from cache, the provider is not hit again", async () => {
  let calls = 0
  const run = () => cached("k", 60, async () => ++calls)
  assert.equal(await run(), 1)
  assert.equal(await run(), 1)
  assert.equal(calls, 1)
})

test("failures are never cached: the next call tries the provider again", async () => {
  let calls = 0
  const run = () => cached("k", 60, async () => { if (++calls === 1) throw new Error("402"); return "ok" })
  await assert.rejects(run(), /402/)
  assert.equal(await run(), "ok")
  assert.equal(calls, 2)
})

test("simultaneous identical calls share one provider call", async () => {
  let calls = 0
  const slow = () => cached("k", 60, async () => { calls++; await new Promise((r) => setTimeout(r, 10)); return 1 })
  await Promise.all([slow(), slow(), slow()])
  assert.equal(calls, 1)
})

test("the shared store is read first and written after a miss; a null result is a valid cached answer", async () => {
  const store = new Map<string, unknown>([["known", { a: 1 }], ["empty", null]])
  const writes: string[] = []
  setSharedCache({ get: async (k) => store.get(k), set: async (k, v) => { writes.push(k); store.set(k, v) } })
  let calls = 0
  assert.deepEqual(await cached("known", 60, async () => (calls++, "fresh")), { a: 1 })
  assert.equal(await cached("empty", 60, async () => (calls++, "fresh")), null)
  assert.equal(calls, 0)
  assert.equal(await cached("new", 60, async () => (calls++, "fresh")), "fresh")
  assert.deepEqual(writes, ["new"])
})

test("a broken shared store never breaks the lookup", async () => {
  setSharedCache({ get: async () => { throw new Error("db down") }, set: async () => { throw new Error("db down") } })
  assert.equal(await cached("k", 60, async () => "ok"), "ok")
})

test("SOCIAL_CACHE_DAYS=0 disables the cache", async () => {
  process.env.SOCIAL_CACHE_DAYS = "0"
  assert.equal(socialTtl(7), 0)
  let calls = 0
  await cached("k", socialTtl(7), async () => ++calls)
  await cached("k", socialTtl(7), async () => ++calls)
  assert.equal(calls, 2)
  delete process.env.SOCIAL_CACHE_DAYS
  assert.equal(socialTtl(7), 7 * 86_400)
})
