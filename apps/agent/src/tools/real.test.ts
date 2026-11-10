import assert from "node:assert/strict"
import { afterEach, beforeEach, test } from "node:test"
import { findCompetitorsTool, googleListing, socialPublic } from "./real.ts"

const realFetch = globalThis.fetch
const rawPlace = (id: string, name: string, address: string, reviews: number) => ({
  id, displayName: { text: name }, formattedAddress: address, location: { latitude: 1, longitude: 2 },
  rating: 4.5, userRatingCount: reviews, websiteUri: "https://biz.test", primaryType: "restaurant",
})
const json = (body: unknown, status = 200) => new Response(JSON.stringify(body), { status, headers: { "Content-Type": "application/json" } })

beforeEach(() => {
  process.env.GOOGLE_PLACES_API_KEY = "test"
  process.env.SCRAPECREATORS_API_KEY = "test"
})
afterEach(() => {
  globalThis.fetch = realFetch
})

test("google_listing: one clear match returns the place", async () => {
  globalThis.fetch = async () => json({ places: [rawPlace("p1", "Katz's Delicatessen", "205 E Houston St, New York", 56000)] })
  const r = await googleListing.run({ name: "Katz's Delicatessen", city: "New York" }, { signal: new AbortController().signal })
  assert.equal(r.status, "ok")
  assert.equal((r.data as { id: string }).id, "p1")
  assert.equal(r.source, "public listing")
})

test("google_listing: several locations return needsChoice instead of guessing", async () => {
  globalThis.fetch = async () => json({ places: [rawPlace("a", "Taco Naco", "Carolina, PR", 100), rawPlace("b", "Taco Naco", "Kansas City, KS", 200)] })
  const r = await googleListing.run({ name: "Taco Naco" }, { signal: new AbortController().signal })
  const d = r.data as { needsChoice: { id: string }[] }
  assert.deepEqual(d.needsChoice.map((p) => p.id), ["b", "a"])
})

test("google_listing: no results is empty; a provider 429 is a rate_limited failure", async () => {
  globalThis.fetch = async () => json({ places: [] })
  assert.equal((await googleListing.run({ name: "Nowhere" }, { signal: new AbortController().signal })).status, "empty")
  globalThis.fetch = async () => json({ error: "quota" }, 429)
  const r = await googleListing.run({ name: "Anything" }, { signal: new AbortController().signal })
  assert.deepEqual([r.status, r.errorClass], ["error", "rate_limited"])
})

test("find_competitors: looks up the place, then nearby ones, excluding itself", async () => {
  let calls = 0
  globalThis.fetch = async () => (++calls === 1 ? json(rawPlace("p1", "Biz", "1 St", 10)) : json({ places: [rawPlace("p1", "Biz", "1 St", 10), rawPlace("r1", "Rival", "2 St", 50)] }))
  const r = await findCompetitorsTool.run({ placeId: "p1abcdefghij" }, { signal: new AbortController().signal })
  assert.deepEqual((r.data as { competitors: { id: string }[] }).competitors.map((c) => c.id), ["r1"])
})

test("social_public: out-of-credits is reported as a failure, not as 'no Instagram'", async () => {
  globalThis.fetch = async (url) => {
    const u = String(url)
    if (u.includes("scrapecreators")) return json({ error: "no credits" }, 402)
    return new Response('<a href="https://www.instagram.com/bizhandle/">ig</a>', { status: 200 })
  }
  const r = await socialPublic.run({ name: "Biz", address: "1 St, Town, TS", website: "https://biz.test" }, { signal: new AbortController().signal })
  assert.deepEqual([r.status, r.errorClass], ["error", "out_of_credits"])
})

test("social_public: a failing search fallback is a failure; a clean miss is empty", async () => {
  const site = '<html>no links</html>'
  globalThis.fetch = async (url) => (String(url).includes("scrapecreators") ? json({}, 402) : new Response(site))
  const failed = await socialPublic.run({ name: "Biz", address: "1 St, Town, TS", website: "https://biz.test" }, { signal: new AbortController().signal })
  assert.deepEqual([failed.status, failed.errorClass], ["error", "out_of_credits"])

  globalThis.fetch = async (url) => (String(url).includes("scrapecreators") ? json({ results: [{ title: "Unrelated", url: "https://www.instagram.com/someoneelse/" }] }) : new Response(site))
  const miss = await socialPublic.run({ name: "Biz", address: "1 St, Town, TS", website: "https://biz.test" }, { signal: new AbortController().signal })
  assert.equal(miss.status, "empty")
})
