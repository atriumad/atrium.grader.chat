// Social data: find handles on a business website, then pull public metrics
// through ScrapeCreators for Instagram, Facebook, TikTok and YouTube.
import type { NetworkStats, Network } from "@atrium/shared/types"

const BASE = "https://api.scrapecreators.com"

const IG_RESERVED = new Set([
  "p", "reel", "reels", "explore", "accounts", "stories", "tv", "share", "about", "developer", "direct",
])

export type SocialLinks = {
  instagram: string | null
  facebook: string | null // full page URL
  tiktok: string | null
  youtube: string | null // full channel URL
}

const FB_RESERVED = new Set([
  "sharer", "sharer.php", "share", "share.php", "tr", "plugins", "dialog", "login", "policies", "help",
  "events", "groups", "watch", "marketplace", "hashtag", "l.php", "privacy", "business", "ads", "reel", "reels", "posts",
])

const NETWORKS_ON = () =>
  new Set((process.env.SOCIAL_NETWORKS ?? "instagram,facebook,tiktok,youtube").split(",").map((x) => x.trim().toLowerCase()))

export function parseSocialLinks(html: string): SocialLinks {
  const links: SocialLinks = { instagram: null, facebook: null, tiktok: null, youtube: null }

  for (const m of html.matchAll(/instagram\.com\/([A-Za-z0-9._]{1,30})/gi)) {
    const handle = m[1].replace(/\.$/, "")
    if (!IG_RESERVED.has(handle.toLowerCase())) {
      links.instagram = handle
      break
    }
  }
  for (const m of html.matchAll(/facebook\.com\/(profile\.php\?id=\d+|(?:pages\/[^/"'\s<>?#]+\/)?[A-Za-z0-9.\-]{3,})/gi)) {
    const first = m[1].split("/")[0].toLowerCase()
    if (!FB_RESERVED.has(first) && (/[A-Za-z]/.test(m[1]) || m[1].startsWith("profile.php"))) {
      links.facebook = `https://www.facebook.com/${m[1]}`
      break
    }
  }
  const tt = html.match(/tiktok\.com\/@([A-Za-z0-9._]{2,24})/i)
  if (tt) links.tiktok = tt[1].replace(/\.$/, "")
  const yt = html.match(/youtube\.com\/(@[A-Za-z0-9._-]+|channel\/UC[\w-]{20,}|c\/[\w-]+|user\/[\w-]+)/i)
  if (yt) links.youtube = `https://www.youtube.com/${yt[1]}`
  return links
}

// One fetch of the business website finds every social link on it.
export async function findSocialLinks(website: string | null): Promise<SocialLinks> {
  const none: SocialLinks = { instagram: null, facebook: null, tiktok: null, youtube: null }
  if (!website) {
    logLookup({ kind: "links", target: null, ok: false, summary: { reason: "sin sitio web" } })
    return none
  }
  const t0 = Date.now()
  try {
    const res = await fetch(website, {
      signal: AbortSignal.timeout(6_000),
      headers: { "User-Agent": "Mozilla/5.0 (compatible; AtriumGrader/0.1)" },
      redirect: "follow",
    })
    if (!res.ok) {
      logLookup({ kind: "links", target: website, ok: false, status: res.status, durationMs: Date.now() - t0, summary: { reason: `el sitio respondió ${res.status}` } })
      return none
    }
    const html = (await res.text()).slice(0, 500_000)
    const links = parseSocialLinks(html)
    logLookup({
      kind: "links", target: website, ok: true, status: res.status, durationMs: Date.now() - t0,
      summary: { finalUrl: res.url, htmlKB: Math.round(html.length / 1024), links },
    })
    return links
  } catch (e) {
    logLookup({ kind: "links", target: website, ok: false, durationMs: Date.now() - t0, error: e instanceof Error ? e.message : String(e), summary: { reason: "sitio inaccesible o bloqueado" } })
    return none // website unreachable or blocked: no links
  }
}

export async function findInstagramHandle(website: string | null): Promise<string | null> {
  return (await findSocialLinks(website)).instagram
}

export async function sc(path: string, params: Record<string, string>) {
  const key = process.env.SCRAPECREATORS_API_KEY
  if (!key) throw new Error("Falta SCRAPECREATORS_API_KEY")
  const url = `${BASE}${path}?${new URLSearchParams(params)}`
  const target = params.handle ?? params.url ?? params.query ?? null
  const t0 = Date.now()
  let status: number | null = null
  try {
    const res = await fetch(url, {
      headers: { "x-api-key": key },
      signal: AbortSignal.timeout(30_000),
    })
    status = res.status
    const text = await res.text()
    if (!res.ok) throw new Error(`ScrapeCreators ${res.status} en ${path}`, { cause: text })
    const json = JSON.parse(text)
    if (typeof json?.credits_charged === "number") logEvent("credits", { path, charged: json.credits_charged, remaining: json.credits_remaining ?? null })
    logLookup({
      kind: "scrape", target, request: { path, params }, ok: true, status, durationMs: Date.now() - t0,
      summary: { credits: json?.credits_charged ?? null, keys: Object.keys(json ?? {}).slice(0, 12) },
      response: text,
    })
    return json
  } catch (e) {
    const err = e as Error & { cause?: unknown }
    logLookup({
      kind: "scrape", target, request: { path, params }, ok: false, status, durationMs: Date.now() - t0,
      error: err.message, response: typeof err.cause === "string" ? err.cause : null,
    })
    throw e
  }
}

import { logEvent, logLookup } from "@/lib/admin/log"
import type { InstagramStats } from "@atrium/shared/types"
export type { InstagramStats }

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

  logLookup({
    kind: "network", target: `Instagram: @${handle}`, ok: followers !== null,
    summary: { resultado: followers !== null ? "leída" : "sin seguidores en la respuesta", ...stats },
  })
  return { stats, extras }
}

// ---------------------------------------------------------------------------
// Facebook, TikTok, YouTube. Same idea as Instagram: profile + a sample of recent posts.
// ---------------------------------------------------------------------------

const MIN_SPAN_DAYS = 3
const MAX_POSTS_PER_WEEK = 21

type PostSample = { likes: number | null; comments: number | null; views: number | null; time: number | null } // time: unix seconds

function summarize(
  network: Network,
  handle: string,
  followers: number | null,
  posts: PostSample[]
): NetworkStats {
  const nums = (f: (p: PostSample) => number | null, min = 0) =>
    posts.map(f).filter((n): n is number => n !== null && Number.isFinite(n) && n >= min)
  const likes = nums((p) => p.likes)
  const comments = nums((p) => p.comments)
  const views = nums((p) => p.views, 1)
  const times = nums((p) => p.time, 1).sort((a, b) => b - a)

  const avgLikes = avg(likes)
  const avgComments = avg(comments)
  const engagement =
    followers && avgLikes !== null
      ? Math.round((((avgLikes + (avgComments ?? 0)) / followers) * 10_000)) / 100
      : null

  let postsPerWeek: number | null = null
  if (times.length >= 2) {
    const spanDays = (times[0] - times[times.length - 1]) / 86_400
    // A tight burst (3 posts the same day) says nothing about frequency; cap what is left.
    postsPerWeek = spanDays >= MIN_SPAN_DAYS ? Math.min(MAX_POSTS_PER_WEEK, Math.round(((times.length - 1) / spanDays) * 7 * 10) / 10) : null
  }
  return {
    network,
    handle,
    followers,
    postsSampled: posts.length,
    avgLikes,
    avgComments,
    avgViews: avg(views),
    engagementRatePct: engagement,
    postsPerWeek,
    lastPostDaysAgo: times.length ? Math.max(0, Math.round((Date.now() / 1000 - times[0]) / 86_400)) : null,
  }
}

const numOrNull = (v: unknown): number | null => {
  const n = Number(v)
  return v !== null && v !== undefined && Number.isFinite(n) ? n : null
}

export async function getTikTokStats(handle: string): Promise<NetworkStats> {
  const [profile, videos] = await Promise.all([
    sc("/v1/tiktok/profile", { handle, cache_max_age: "7d" }),
    sc("/v3/tiktok/profile/videos", { handle, trim: "true" }),
  ])
  const followers = numOrNull(profile?.stats?.followerCount ?? profile?.user?.stats?.followerCount)
  const list: Array<Record<string, any>> = Array.isArray(videos?.aweme_list) ? videos.aweme_list : []
  return summarize(
    "tiktok",
    handle,
    followers,
    list.map((v) => ({
      likes: numOrNull(v.statistics?.digg_count),
      comments: numOrNull(v.statistics?.comment_count),
      views: numOrNull(v.statistics?.play_count),
      time: numOrNull(v.create_time),
    }))
  )
}

export async function getFacebookStats(url: string): Promise<NetworkStats> {
  const [profile, posts] = await Promise.all([
    sc("/v1/facebook/profile", { url }),
    sc("/v1/facebook/profile/posts", { url }),
  ])
  if (profile?.success === false) throw new Error(profile?.message ?? "perfil no disponible")
  const list: Array<Record<string, any>> = Array.isArray(posts?.posts) ? posts.posts : []
  return summarize(
    "facebook",
    String(profile?.name ?? url.replace(/^https?:\/\/(www\.)?facebook\.com\//, "")),
    numOrNull(profile?.followerCount ?? profile?.likeCount),
    list.map((p) => ({
      likes: numOrNull(p.reactionCount),
      comments: numOrNull(p.commentCount),
      views: numOrNull(p.videoViewCount),
      time: numOrNull(p.publishTime),
    }))
  )
}

const YT_SAMPLE = 12

export async function getYouTubeStats(url: string): Promise<NetworkStats> {
  const [channel, videos] = await Promise.all([
    sc("/v1/youtube/channel", { url, cache_max_age: "7d" }),
    // channel-videos takes handle / channelId, not url: derive it from the link.
    sc("/v1/youtube/channel-videos", youtubeRef(url)),
  ])
  const list: Array<Record<string, any>> = Array.isArray(videos?.videos) ? videos.videos.slice(0, YT_SAMPLE) : []
  return summarize(
    "youtube",
    String(channel?.name ?? url),
    numOrNull(channel?.subscriberCount),
    list.map((v) => ({
      likes: null, // the video list does not include likes
      comments: null,
      views: numOrNull(v.viewCountInt),
      time: v.publishedTime ? Math.floor(new Date(v.publishedTime).getTime() / 1000) : null,
    }))
  )
}

function youtubeRef(url: string): Record<string, string> {
  const path = url.replace(/^https?:\/\/(www\.)?youtube\.com\//, "")
  if (path.startsWith("@")) return { handle: path.slice(1) }
  if (path.startsWith("channel/")) return { channelId: path.slice("channel/".length) }
  // /c/name and /user/name: the last segment works as a handle in most cases.
  return { handle: path.split("/").pop() ?? path }
}

// A tiny channel whose last post is over a year old is not the business's channel (a
// chef's personal account linked from the site) or is dead: it should not count either way.
function isAbandoned(n: NetworkStats): boolean {
  return (n.followers ?? 0) < 100 && n.lastPostDaysAgo !== null && n.lastPostDaysAgo > 365
}

// Reads every network that was found on the website and is enabled (SOCIAL_NETWORKS).
// A failing network is skipped and reported in `note`; it never breaks the analysis.
export async function getNetworkStats(
  links: SocialLinks
): Promise<{ networks: NetworkStats[]; note: string | undefined }> {
  const on = NETWORKS_ON()
  const jobs: Array<{ name: string; target: string; run: () => Promise<NetworkStats> }> = []
  if (on.has("facebook") && links.facebook) jobs.push({ name: "Facebook", target: links.facebook, run: () => getFacebookStats(links.facebook!) })
  if (on.has("tiktok") && links.tiktok) jobs.push({ name: "TikTok", target: links.tiktok, run: () => getTikTokStats(links.tiktok!) })
  if (on.has("youtube") && links.youtube) jobs.push({ name: "YouTube", target: links.youtube, run: () => getYouTubeStats(links.youtube!) })
  const results = await Promise.allSettled(jobs.map((j) => j.run()))
  const networks: NetworkStats[] = []
  const failed: string[] = []
  results.forEach((r, i) => {
    const name = jobs[i].name
    const log = (ok: boolean, summary: unknown, error?: string) =>
      logLookup({ kind: "network", target: `${name}: ${jobs[i].target}`, ok, summary, error })
    if (r.status === "rejected") {
      failed.push(`${name} no disponible`)
      log(false, { resultado: "falló la consulta" }, r.reason instanceof Error ? r.reason.message : String(r.reason))
    } else if (r.value.postsSampled === 0) {
      failed.push(`${name} sin posts visibles`)
      log(false, { resultado: "descartada: sin posts visibles", ...r.value })
    } else if (isAbandoned(r.value)) {
      failed.push(`${name} (${r.value.handle}) parece abandonado o no es la cuenta del negocio`)
      log(false, { resultado: "descartada: abandonada o no es del negocio", ...r.value })
    } else {
      networks.push(r.value)
      log(true, { resultado: "usada en el diagnóstico", ...r.value })
    }
  })
  return { networks, note: failed.length ? failed.join("; ") : undefined }
}

export function instagramEnabled(): boolean {
  return NETWORKS_ON().has("instagram")
}
