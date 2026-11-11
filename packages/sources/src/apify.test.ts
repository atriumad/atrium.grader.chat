import assert from "node:assert/strict"
import { afterEach, beforeEach, test } from "node:test"
import { classifyError } from "./errors.ts"
import { apify, apifyEnabled, instagramShaped, tiktokShaped } from "./apify.ts"

const realFetch = globalThis.fetch
const json = (body: unknown, status = 200) => new Response(JSON.stringify(body), { status })
beforeEach(() => { process.env.APIFY_TOKEN = "t"; process.env.APIFY_RETRY_MS = "0" })
afterEach(() => { globalThis.fetch = realFetch; delete process.env.SOCIAL_PROVIDER })

test("apifyEnabled only when SOCIAL_PROVIDER=apify", () => {
  assert.equal(apifyEnabled(), false)
  process.env.SOCIAL_PROVIDER = "Apify"
  assert.equal(apifyEnabled(), true)
})

test("provider failures keep their class: 402 and a monthly-limit 403 are out_of_credits, 429 is rate_limited", async () => {
  const classOf = async (status: number, body: unknown) => {
    globalThis.fetch = async () => json(body, status)
    return apify("a~b", {}).then(() => "ok", classifyError)
  }
  assert.equal(await classOf(402, { error: { type: "not-enough-usage-to-run-paid-actor" } }), "out_of_credits")
  assert.equal(await classOf(403, { error: { message: "Monthly usage hard limit exceeded" } }), "out_of_credits")
  assert.equal(await classOf(429, {}), "rate_limited")
})

test("instagram: maps profile and latest posts to the shape the stats code reads", async () => {
  globalThis.fetch = async () => json([{ followersCount: 1000, postsCount: 50, verified: false, businessCategoryName: "Restaurant", latestPosts: [{ likesCount: 90, commentsCount: 10, timestamp: "2026-11-09T16:00:47.000Z", videoViewCount: 500 }] }])
  const r = await instagramShaped("biz")
  assert.equal(r.profile.data.user.edge_followed_by.count, 1000)
  assert.deepEqual(r.posts.items.map((i) => [i.like_count, i.comment_count, i.play_count]), [[90, 10, 500]])
  assert.ok((r.posts.items[0].taken_at ?? 0) > 0)
})

test("instagram: an empty profile (handle does not exist) is not_found, not a business with 0 followers", async () => {
  globalThis.fetch = async () => json([{ followersCount: 0, postsCount: 7, latestPosts: [] }])
  assert.equal(await instagramShaped("nobody").then(() => "ok", classifyError), "not_found")
  globalThis.fetch = async () => json([])
  assert.equal(await instagramShaped("nobody").then(() => "ok", classifyError), "not_found")
})

test("tiktok: followers come from the author of the videos", async () => {
  globalThis.fetch = async () => json([{ authorMeta: { fans: 3000 }, diggCount: 5, commentCount: 1, playCount: 100, createTimeISO: "2026-11-10T18:37:22.000Z" }])
  const r = await tiktokShaped("biz")
  assert.equal(r.profile.stats.followerCount, 3000)
  assert.equal(r.videos.aweme_list.length, 1)
})

test("a 402 is retried once: a transient one succeeds, a real out-of-credits stays out_of_credits", async () => {
  let calls = 0
  globalThis.fetch = async () => (++calls === 1 ? json({}, 402) : json([{ ok: 1 }]))
  assert.deepEqual(await apify("a~b", {}), [{ ok: 1 }])
  assert.equal(calls, 2)
  calls = 0
  globalThis.fetch = async () => (calls++, json({}, 402))
  assert.equal(await apify("a~b", {}).then(() => "ok", classifyError), "out_of_credits")
  assert.equal(calls, 2) // one try plus one retry, no more
})

test("never more than 3 Apify runs at once", async () => {
  let now = 0
  let peak = 0
  globalThis.fetch = async () => {
    peak = Math.max(peak, ++now)
    await new Promise((r) => setTimeout(r, 10))
    now--
    return json([{}])
  }
  await Promise.all(Array.from({ length: 10 }, () => apify("a~b", {})))
  assert.equal(peak, 3)
})
