// Apify as an alternative social data provider (SOCIAL_PROVIDER=apify). Each function returns the same
// shape the ScrapeCreators calls return, so the stats code in socials.ts stays one implementation.
import { logLookup } from "./log.ts"

const API = "https://api.apify.com/v2"

// Posts or videos sampled per account. Fewer items cost less and run faster; 5 is enough for an average.
const SAMPLE = 5

// The free plan allows 5 concurrent runs and a run that does not fit can come back as 402 even with
// balance left. Cap our own concurrency below that and retry a 402 once before calling it "no credits".
const MAX_CONCURRENT = 3
let running = 0
const waiting: Array<() => void> = []
async function slot<T>(fn: () => Promise<T>): Promise<T> {
  if (running >= MAX_CONCURRENT) await new Promise<void>((r) => waiting.push(r))
  running++
  try {
    return await fn()
  } finally {
    running--
    waiting.shift()?.()
  }
}

export const apifyEnabled = (): boolean => (process.env.SOCIAL_PROVIDER ?? "").toLowerCase() === "apify"

// Runs an actor and returns its dataset. Provider failures carry an HTTP-like `status`, so
// classifyError tells "out of credits" or "rate limited" apart from "the account does not exist".
export async function apify(actor: string, input: unknown, target: string | null = null): Promise<Array<Record<string, any>>> {
  return slot(async () => {
    try {
      return await apifyOnce(actor, input, target)
    } catch (e) {
      if ((e as { status?: number }).status !== 402) throw e
      await new Promise((r) => setTimeout(r, Number(process.env.APIFY_RETRY_MS ?? 4_000)))
      return apifyOnce(actor, input, target)
    }
  })
}

async function apifyOnce(actor: string, input: unknown, target: string | null): Promise<Array<Record<string, any>>> {
  const token = process.env.APIFY_TOKEN
  if (!token) throw new Error("APIFY_TOKEN is missing")
  const t0 = Date.now()
  let status: number | null = null
  try {
    const res = await fetch(`${API}/acts/${actor}/run-sync-get-dataset-items`, {
      method: "POST",
      headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` },
      body: JSON.stringify(input),
      signal: AbortSignal.timeout(150_000),
    })
    status = res.status
    const text = await res.text()
    if (!res.ok) {
      // Apify answers 402 when the plan cannot pay for the run; a monthly cap can come as 403.
      const credits = res.status === 402 || (res.status === 403 && /usage|limit|credit/i.test(text))
      throw Object.assign(new Error(`Apify ${res.status} en ${actor}`, { cause: text }), { status: credits ? 402 : res.status })
    }
    const items = JSON.parse(text) as Array<Record<string, any>>
    logLookup({
      kind: "scrape", target, request: { actor, input }, ok: true, status, durationMs: Date.now() - t0,
      summary: { items: items.length, keys: Object.keys(items[0] ?? {}).slice(0, 12) }, response: text.slice(0, 20_000),
    })
    return items
  } catch (e) {
    const err = e as Error & { cause?: unknown; status?: number }
    logLookup({
      kind: "scrape", target, request: { actor, input }, ok: false, status, durationMs: Date.now() - t0,
      error: err.message, response: typeof err.cause === "string" ? err.cause.slice(0, 2_000) : null,
    })
    throw e
  }
}

const notFound = (what: string) => Object.assign(new Error(`${what} no encontrado`), { status: 404 })
const secs = (iso: unknown): number | null => {
  const t = typeof iso === "string" || typeof iso === "number" ? new Date(iso).getTime() : NaN
  return Number.isFinite(t) ? Math.floor(t / 1000) : null
}

// One run returns the profile and its latest 12 posts.
export async function instagramShaped(handle: string) {
  const p = (await apify("apify~instagram-profile-scraper", { usernames: [handle] }, `Instagram: @${handle}`))[0]
  // The actor answers with an empty profile for handles that do not exist.
  if (!p || p.error || (!p.followersCount && !p.latestPosts?.length)) throw notFound(`Instagram @${handle}`)
  const posts: Array<Record<string, any>> = Array.isArray(p.latestPosts) ? p.latestPosts : []
  return {
    profile: {
      data: {
        user: {
          edge_followed_by: { count: p.followersCount ?? null },
          edge_owner_to_timeline_media: { count: p.postsCount ?? null },
          category_name: p.businessCategoryName ?? null,
          is_verified: p.verified ?? null,
          full_name: p.fullName ?? null,
          external_url: p.externalUrls?.[0]?.url ?? p.externalUrl ?? null,
          is_business_account: p.isBusinessAccount ?? false,
          business_address_json: p.businessAddress ?? null,
          edge_related_profiles: { edges: (p.relatedProfiles ?? []).map((r: { username?: string; is_private?: boolean }) => ({ node: r })) },
        },
      },
    },
    posts: {
      // likesCount is -1 when the owner hides likes: the stats code drops negatives.
      items: posts.map((x) => ({ like_count: x.likesCount, comment_count: x.commentsCount, play_count: x.videoPlayCount ?? x.videoViewCount, taken_at: secs(x.timestamp) })),
    },
  }
}

export async function tiktokShaped(handle: string) {
  const items = await apify("clockworks~tiktok-scraper", { profiles: [handle], resultsPerPage: SAMPLE, profileScrapeSections: ["videos"], profileSorting: "latest" }, `TikTok: ${handle}`)
  if (!items.length) throw notFound(`TikTok ${handle}`)
  return {
    profile: { stats: { followerCount: items[0].authorMeta?.fans ?? null } },
    videos: { aweme_list: items.map((v) => ({ statistics: { digg_count: v.diggCount, comment_count: v.commentCount, play_count: v.playCount }, create_time: secs(v.createTimeISO ?? v.createTime) })) },
  }
}

export async function facebookShaped(url: string) {
  const [pages, posts] = await Promise.all([
    apify("apify~facebook-pages-scraper", { startUrls: [{ url }] }, `Facebook: ${url}`),
    apify("apify~facebook-posts-scraper", { startUrls: [{ url }], resultsLimit: SAMPLE }, `Facebook: ${url}`),
  ])
  const page = pages[0]
  if (!page || page.error) throw notFound(`Facebook ${url}`)
  return {
    profile: { name: page.title ?? page.pageName, followerCount: page.followers ?? null, likeCount: page.likes ?? null },
    posts: { posts: posts.filter((x) => !x.error).map((x) => ({ reactionCount: x.likes, commentCount: x.comments, videoViewCount: x.viewsCount, publishTime: secs(x.time ?? x.timestamp) })) },
  }
}

export async function youtubeShaped(url: string) {
  const items = await apify("streamers~youtube-scraper", { startUrls: [{ url }], maxResults: SAMPLE, maxResultsShorts: 0, maxResultStreams: 0 }, `YouTube: ${url}`)
  if (!items.length) throw notFound(`YouTube ${url}`)
  return {
    channel: { name: items[0].channelName ?? url, subscriberCount: items[0].numberOfSubscribers ?? null },
    videos: { videos: items.map((v) => ({ viewCountInt: v.viewCount, publishedTime: v.date })) },
  }
}

export async function googleSearchShaped(query: string): Promise<{ results: { title?: string; url?: string }[] }> {
  const items = await apify("apify~google-search-scraper", { queries: query, resultsPerPage: 8, maxPagesPerQuery: 1, countryCode: "us", languageCode: "en" }, query)
  return { results: (items[0]?.organicResults ?? []).map((r: { title?: string; url?: string }) => ({ title: r.title, url: r.url })) }
}
