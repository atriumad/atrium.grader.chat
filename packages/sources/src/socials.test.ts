import assert from "node:assert/strict"
import { test } from "node:test"
import { pickInstagramHandle } from "./socials.ts"
import { resolver } from "./safe-fetch.ts"

resolver.lookup = (async () => [{ address: "93.184.216.34", family: 4 }])

test("a profile URL whose title names the business is accepted", () => {
  const results = [{ title: "Boheme (@barboheme) • Instagram photos and videos", url: "https://www.instagram.com/barboheme/" }]
  assert.equal(pickInstagramHandle(results, "Boheme"), "barboheme")
})

test("a post under the handle is enough when Google returns no profile page", () => {
  const results = [
    { title: "barboheme - Instagram", url: "https://www.instagram.com/p/DBUV-K2JJrQ/?hl=en" },
    { title: "PSA: Boheme is the spot for your next private event. ...", url: "https://www.instagram.com/barboheme/p/DdIKP89DY5c/?hl=cs" },
  ]
  assert.equal(pickInstagramHandle(results, "Boheme"), "barboheme")
})

test("a post of another account that does not mention the business is rejected", () => {
  const results = [{ title: "Happy Hour all day", url: "https://www.instagram.com/someotherbar/p/ABC123/" }]
  assert.equal(pickInstagramHandle(results, "Boheme"), null)
})

test("anonymous post URLs and non-Instagram results are ignored", () => {
  const results = [
    { title: "Boheme night", url: "https://www.instagram.com/p/DLP2_NhAAMd/" },
    { title: "Boheme (@barboheme)", url: "https://example.com/boheme" },
  ]
  assert.equal(pickInstagramHandle(results, "Boheme"), null)
})

test("a blocked website (403) is not cached as having no social links", async () => {
  const { clearMemoryCache, setSharedCache } = await import("./cache.ts")
  const { findSocialLinks } = await import("./socials.ts")
  clearMemoryCache()
  setSharedCache(null)
  const original = globalThis.fetch
  let calls = 0
  globalThis.fetch = (async () => {
    calls++
    return new Response("blocked", { status: 403 })
  }) as typeof fetch
  try {
    const first = await findSocialLinks("https://blocked.example/")
    assert.equal(first.instagram, null)
    const before = calls
    await findSocialLinks("https://blocked.example/")
    assert.ok(calls > before, "the second call must try the website again")
  } finally {
    globalThis.fetch = original
  }
})
