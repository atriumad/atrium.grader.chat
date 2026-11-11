// Live lookups the chat agent can run: fresh social numbers, Google reputation,
// a website SEO check and Google search ranking. Read-only; each returns compact JSON.

import type { Dataset } from "@/lib/analysis"
import { findBusiness } from "@/lib/places"
import { auditWebsite } from "@atrium/sources/website-audit"
import {
  getFacebookStats,
  getInstagramStats,
  getTikTokStats,
  getYouTubeStats,
  sc,
} from "@/lib/socials"

type Entity = Dataset["business"]
const entities = (d: Dataset): Entity[] => [d.business, ...d.competitors]

function hostOf(u: string): string | null {
  try {
    return new URL(/^https?:\/\//i.test(u) ? u : `https://${u}`).hostname.replace(/^www\./, "").toLowerCase()
  } catch {
    return null
  }
}

function findEntity(d: Dataset, name: unknown): Entity {
  const q = typeof name === "string" ? name.trim().toLowerCase() : ""
  if (!q) return d.business
  return entities(d).find((e) => e.name.toLowerCase().includes(q)) ?? d.business
}

// ---- 1. Social numbers, live ------------------------------------------------

const HANDLE = /^@?[A-Za-z0-9._]{1,30}$/

export async function liveSocial(d: Dataset, input: Record<string, unknown>) {
  const network = String(input.network ?? "")
  const entity = findEntity(d, input.business)
  const given = typeof input.handle_or_url === "string" ? input.handle_or_url.trim() : ""
  const stats =
    network === "instagram"
      ? await (async () => {
          const h = (given || entity.instagram?.handle || "").replace(/^@/, "")
          if (!HANDLE.test(h)) throw new Error("There is no Instagram username for that business.")
          return getInstagramStats(h)
        })()
      : await (async () => {
          const known = entity.networks?.find((n) => n.network === network)?.handle
          const ref = given || known || ""
          if (!ref) throw new Error(`No ${network} account was found for that business.`)
          if (network === "tiktok") {
            if (!HANDLE.test(ref)) throw new Error("Invalid TikTok username.")
            return getTikTokStats(ref.replace(/^@/, ""))
          }
          if (network === "facebook") {
            if (!/^https:\/\/(www\.)?facebook\.com\//i.test(ref)) throw new Error("Provide the full Facebook URL.")
            return getFacebookStats(ref)
          }
          if (network === "youtube") {
            if (!/^https:\/\/(www\.)?youtube\.com\//i.test(ref)) throw new Error("Provide the YouTube channel URL.")
            return getYouTubeStats(ref)
          }
          throw new Error("Red no soportada.")
        })()
  // What the diagnostic had, so the model can compare and flag differences.
  const before =
    network === "instagram"
      ? entity.instagram && { followers: entity.instagram.followers, engagementPct: entity.instagram.engagementRatePct }
      : entity.networks?.find((n) => n.network === network) &&
        (({ followers, engagementRatePct }) => ({ followers: followers, engagementPct: engagementRatePct }))(
          entity.networks!.find((n) => n.network === network)!
        )
  return { business: entity.name, network, now: stats, inTheDiagnosis: before ?? null }
}

// ---- 2. Google reputation, live ----------------------------------------------

export async function liveGoogle(d: Dataset, input: Record<string, unknown>) {
  const entity = findEntity(d, input.business)
  const p = await findBusiness(`${entity.name} ${entity.place?.address ?? ""}`.trim())
  if (!p) return { business: entity.name, result: "Not found on Google Maps." }
  return {
    business: p.name,
    address: p.address,
    rating: p.rating,
    reviews: p.reviews,
    website: p.website,
    inTheDiagnosis: entity.place ? { rating: entity.place.rating, reviews: entity.place.reviews } : null,
  }
}

// ---- 3. SEO check of a business website ---------------------------------------

export async function seoAudit(d: Dataset, input: Record<string, unknown>) {
  const entity = findEntity(d, input.business)
  const site = entity.place?.website
  if (!site) return { business: entity.name, result: "The business has no website on Google Maps." }
  // Only sites that came from the analysis: the model cannot point this at arbitrary URLs.
  const allowedHosts = entities(d).map((e) => (e.place?.website ? hostOf(e.place.website) : null)).filter((h): h is string => !!h)
  return auditWebsite(site, { name: entity.name, city: (entity.place?.address ?? "").split(",")[1]?.trim(), allowedHosts })
}

// ---- 4. Where the business shows up on Google ----------------------------------

export async function searchRanking(d: Dataset, input: Record<string, unknown>) {
  const query = String(input.query ?? "").trim().slice(0, 120)
  if (query.length < 3) throw new Error("Query too short.")
  const entity = findEntity(d, input.business)
  const data = await sc("/v1/google/search", { query, country: "us", language: "en" })
  const results: Array<{ title: string; url: string; description?: string }> = Array.isArray(data?.results) ? data.results : []
  const mine = new Set([entity.place?.website, ...(entity.networks ?? []).map(() => null)].map((u) => (u ? hostOf(u) : null)).filter(Boolean))
  const compHosts = new Map(d.competitors.map((c) => [c.place?.website ? hostOf(c.place.website) : null, c.name] as const))
  const rows = results.map((r, i) => {
    const h = hostOf(r.url)
    return {
      position: i + 1,
      title: r.title,
      domain: h,
      isTheBusiness: !!h && mine.has(h),
      competitor: (h && compHosts.get(h)) || undefined,
    }
  })
  const pos = rows.find((r) => r.isTheBusiness)?.position ?? null
  return {
    query: query,
    business: entity.name,
    businessSitePosition: pos,
    note: pos ? undefined : "Does not appear in the first 10 organic results for this query (excluding Google Maps and local results).",
    top10: rows,
  }
}
