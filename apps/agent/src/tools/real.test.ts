import assert from "node:assert/strict"
import { afterEach, beforeEach, test } from "node:test"
import { clearMemoryCache } from "@atrium/sources/cache"
import { findCompetitorsTool, googleListing, socialPublic, websiteAudit } from "./real.ts"

import { resolver } from "@atrium/sources/safe-fetch"

resolver.lookup = (async () => [{ address: "93.184.216.34", family: 4 }])
const realFetch = globalThis.fetch
const rawPlace = (id: string, name: string, address: string, reviews: number) => ({
  id, displayName: { text: name }, formattedAddress: address, location: { latitude: 1, longitude: 2 },
  rating: 4.5, userRatingCount: reviews, websiteUri: "https://biz.test", primaryType: "restaurant",
})
const json = (body: unknown, status = 200) => new Response(JSON.stringify(body), { status, headers: { "Content-Type": "application/json" } })

beforeEach(() => {
  clearMemoryCache() // the lookups cache by account: tests must not see each other's results
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

const HOME = '<html><head><title>Biz Town</title><meta name="description" content="Tacos"><meta name="viewport" content="width=device-width"><script type="application/ld+json">{"@type":"Restaurant"}</script></head><body><h1>Biz</h1><p>menu 555 123 4567</p></body></html>'
const fakeSite = (finalUrl?: string) => async (url: string | URL | Request) => {
  const u = String(url)
  if (u.endsWith("/robots.txt")) return new Response("User-agent: *\nAllow: /")
  if (u.endsWith("/sitemap.xml")) return new Response("<urlset/>")
  const res = new Response(HOME, { status: 200 })
  Object.defineProperty(res, "url", { value: finalUrl ?? u })
  return res
}
const audit = (input: Record<string, unknown>, subjectHosts?: string[]) => websiteAudit.run(input, { signal: new AbortController().signal, subjectHosts })

test("website_audit: audits the subject's own site", async () => {
  globalThis.fetch = fakeSite()
  const r = await audit({ url: "https://www.biz.test/", city: "Town" }, ["biz.test"])
  const d = r.data as { hasRestaurantSchema: boolean; title: { mentionsCity: boolean }; mobileViewport: boolean }
  assert.equal(r.status, "ok")
  assert.deepEqual([d.hasRestaurantSchema, d.title.mentionsCity, d.mobileViewport], [true, true, true])
})

test("website_audit: refuses other hosts, private hosts, no known subject host, and cross-domain redirects", async () => {
  let fetched = 0
  globalThis.fetch = async () => (fetched++, new Response(HOME))
  assert.equal((await audit({ url: "https://other.test" }, ["biz.test"])).status, "empty")
  assert.equal((await audit({ url: "http://169.254.169.254/latest" }, ["169.254.169.254"])).status, "empty")
  assert.equal((await audit({ url: "http://localhost:3000" }, ["localhost"])).status, "empty")
  assert.equal((await audit({ url: "https://biz.test" })).status, "empty") // ctx without subjectHosts
  assert.equal(fetched, 0)
  globalThis.fetch = fakeSite("https://evil.test/")
  const r = await audit({ url: "https://biz.test" }, ["biz.test"])
  assert.equal(r.status, "empty")
  assert.match((r.data as { result: string }).result, /redirects/)
})

test("website_audit: a timeout is reported as a failure", async () => {
  globalThis.fetch = async () => { throw Object.assign(new Error("t"), { name: "TimeoutError" }) }
  const r = await audit({ url: "https://biz.test" }, ["biz.test"])
  assert.deepEqual([r.status, r.errorClass], ["error", "timeout"])
})

test("website_audit: an error page or bot wall is empty, not an audit of the wall", async () => {
  globalThis.fetch = async (url) => { const r = new Response("<title>Human Verification</title>", { status: 405 }); Object.defineProperty(r, "url", { value: String(url) }); return r }
  const r = await audit({ url: "https://biz.test" }, ["biz.test"])
  assert.equal(r.status, "empty")
  assert.match((r.data as { result: string }).result, /405/)
})
