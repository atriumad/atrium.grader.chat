// Social data: find handles on a business website, then pull public Instagram
// metrics through ScrapeCreators. Facebook and TikTok are not wired up yet.

const BASE = "https://api.scrapecreators.com"

const IG_RESERVED = new Set([
  "p", "reel", "reels", "explore", "accounts", "stories", "tv", "share", "about", "developer", "direct",
])

export async function findInstagramHandle(website: string | null): Promise<string | null> {
  if (!website) return null
  try {
    const res = await fetch(website, {
      signal: AbortSignal.timeout(6_000),
      headers: { "User-Agent": "Mozilla/5.0 (compatible; AtriumGrader/0.1)" },
      redirect: "follow",
    })
    if (!res.ok) return null
    const html = (await res.text()).slice(0, 500_000)
    const re = /instagram\.com\/([A-Za-z0-9._]{1,30})/gi
    for (const m of html.matchAll(re)) {
      const handle = m[1].replace(/\.$/, "")
      if (!IG_RESERVED.has(handle.toLowerCase())) return handle
    }
  } catch {
    // website unreachable or blocked: no handle
  }
  return null
}

async function sc(path: string, params: Record<string, string>) {
  const key = process.env.SCRAPECREATORS_API_KEY
  if (!key) throw new Error("Falta SCRAPECREATORS_API_KEY")
  const url = `${BASE}${path}?${new URLSearchParams(params)}`
  const res = await fetch(url, {
    headers: { "x-api-key": key },
    signal: AbortSignal.timeout(30_000),
  })
  if (!res.ok) throw new Error(`ScrapeCreators ${res.status} en ${path}`)
  return res.json()
}

export type InstagramStats = {
  handle: string
  followers: number | null
  totalPosts: number | null
  category: string | null
  verified: boolean | null
  postsSampled: number
  avgLikes: number | null
  avgComments: number | null
  avgViews: number | null
  engagementRatePct: number | null
  postsPerWeek: number | null
  lastPostDaysAgo: number | null
}

function avg(nums: number[]): number | null {
  return nums.length ? Math.round(nums.reduce((a, b) => a + b, 0) / nums.length) : null
}

export type InstagramExtras = {
  fullName: string | null
  externalUrl: string | null
  city: string | null
  street: string | null
  isBusiness: boolean
  related: string[]
}

// Accepts "@handle", "ig:handle" or an instagram.com URL. Plain words are NOT
// treated as handles, because they are usually business names.
export function parseInstagramInput(input: string): string | null {
  const s = input.trim()
  const url = s.match(/instagram\.com\/([A-Za-z0-9._]{1,30})/i)
  if (url && !IG_RESERVED.has(url[1].toLowerCase())) return url[1].replace(/\.$/, "")
  const at = s.match(/^@([A-Za-z0-9._]{1,30})$/)
  if (at) return at[1]
  const ig = s.match(/^ig:\s*@?([A-Za-z0-9._]{1,30})$/i)
  if (ig) return ig[1]
  return null
}

export async function getInstagramStats(handle: string): Promise<InstagramStats> {
  return (await getInstagramSnapshot(handle)).stats
}

export async function getInstagramSnapshot(
  handle: string
): Promise<{ stats: InstagramStats; extras: InstagramExtras }> {
  const [profile, posts] = await Promise.all([
    sc("/v1/instagram/profile", { handle, trim: "true", cache_max_age: "7d" }),
    sc("/v2/instagram/user/posts", { handle, trim: "true" }),
  ])

  const user = profile?.data?.user ?? {}
  const followers: number | null = user?.edge_followed_by?.count ?? null

  const items: Array<Record<string, unknown>> = Array.isArray(posts?.items) ? posts.items : []
  const likes = items.map((i) => Number(i.like_count)).filter((n) => Number.isFinite(n) && n >= 0)
  const comments = items.map((i) => Number(i.comment_count)).filter((n) => Number.isFinite(n) && n >= 0)
  const views = items.map((i) => Number(i.play_count)).filter((n) => Number.isFinite(n) && n > 0)
  const times = items
    .map((i) => Number(i.taken_at))
    .filter((n) => Number.isFinite(n) && n > 0)
    .sort((a, b) => b - a)

  const avgLikes = avg(likes)
  const avgComments = avg(comments)
  const engagement =
    followers && avgLikes !== null && avgComments !== null
      ? Math.round(((avgLikes + avgComments) / followers) * 10_000) / 100
      : null

  let postsPerWeek: number | null = null
  if (times.length >= 2) {
    const spanDays = (times[0] - times[times.length - 1]) / 86_400
    postsPerWeek = spanDays > 0 ? Math.round(((times.length - 1) / spanDays) * 7 * 10) / 10 : null
  }
  const lastPostDaysAgo = times.length
    ? Math.max(0, Math.round((Date.now() / 1000 - times[0]) / 86_400))
    : null

  const stats: InstagramStats = {
    handle,
    followers,
    totalPosts: user?.edge_owner_to_timeline_media?.count ?? null,
    category: user?.category_name ?? null,
    verified: user?.is_verified ?? null,
    postsSampled: items.length,
    avgLikes,
    avgComments,
    avgViews: avg(views),
    engagementRatePct: engagement,
    postsPerWeek,
    lastPostDaysAgo,
  }

  let addr: Record<string, unknown> = {}
  try {
    const raw = user?.business_address_json
    addr = typeof raw === "string" ? JSON.parse(raw) : (raw ?? {})
  } catch {
    addr = {}
  }
  const relatedEdges: Array<{ node?: { username?: string; is_private?: boolean } }> =
    user?.edge_related_profiles?.edges ?? []

  const extras: InstagramExtras = {
    fullName: user?.full_name || null,
    externalUrl: user?.external_url || null,
    city: (addr.city_name as string) || null,
    street: (addr.street_address as string) || null,
    isBusiness: Boolean(user?.is_business_account || user?.is_professional_account),
    related: relatedEdges
      .map((e) => e?.node)
      .filter((n): n is { username: string; is_private?: boolean } => Boolean(n?.username) && !n?.is_private)
      .map((n) => n.username),
  }

  return { stats, extras }
}
