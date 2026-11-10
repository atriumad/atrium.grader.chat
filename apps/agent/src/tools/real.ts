import { classifyError } from "@atrium/sources/errors"
import { decide } from "@atrium/sources/match"
import { findCandidates, findCompetitors, getPlace } from "@atrium/sources/places"
import { readSocials } from "@atrium/sources/read-socials"
import type { ToolDef, ToolResult } from "./types.ts"
import { failure } from "./types.ts"

// Neutral source labels: vendor names stay out of results (they remain in the admin lookup log).
const LISTING = "public listing"
const PROFILE = "public profile"

const str = (v: unknown, max = 300): string | undefined => (typeof v === "string" && v.trim() ? v.trim().slice(0, max) : undefined)
const num = (v: unknown, min: number, max: number, fallback: number): number =>
  typeof v === "number" && Number.isFinite(v) ? Math.min(max, Math.max(min, Math.round(v))) : fallback
const done = (status: ToolResult["status"], data: unknown, source: string): ToolResult => ({ status, data, source, fetchedAt: new Date().toISOString() })

export const googleListing: ToolDef = {
  name: "google_listing",
  async run(input) {
    try {
      const placeId = str(input.placeId)
      if (placeId) {
        const place = await getPlace(placeId)
        return place ? done("ok", place, LISTING) : done("empty", null, LISTING)
      }
      const name = str(input.name)
      if (!name) return done("empty", null, LISTING)
      const query = [name, str(input.city)].filter(Boolean).join(" ")
      const decision = decide(query, await findCandidates(query, 5))
      if (decision.action === "none") return done("empty", null, LISTING)
      // Several locations or a weak match: the caller must choose, the agent never guesses.
      if (decision.action === "ask") return done("ok", { needsChoice: decision.options, reason: decision.reason }, LISTING)
      return done("ok", decision.place, LISTING)
    } catch (e) {
      return failure(classifyError(e), LISTING)
    }
  },
  summarize(r) {
    const d = r.data as { name?: string; rating?: number | null; needsChoice?: unknown[] } | null
    if (d?.needsChoice) return `${d.needsChoice.length} locales posibles`
    return d?.name ? `${d.name}${d.rating ? ` · ${d.rating}★` : ""}` : undefined
  },
}

export const findCompetitorsTool: ToolDef = {
  name: "find_competitors",
  async run(input) {
    try {
      const placeId = str(input.placeId)
      const place = placeId ? await getPlace(placeId) : null
      if (!place) return done("empty", null, LISTING)
      const competitors = await findCompetitors(place, num(input.maxResults, 1, 10, 5), num(input.radiusMeters, 500, 5000, 3000))
      return competitors.length ? done("ok", { competitors }, LISTING) : done("empty", null, LISTING)
    } catch (e) {
      return failure(classifyError(e), LISTING)
    }
  },
  summarize(r) {
    const list = (r.data as { competitors?: unknown[] } | null)?.competitors
    return list ? `${list.length} cerca` : undefined
  },
}

export const socialPublic: ToolDef = {
  name: "social_public",
  async run(input) {
    const name = str(input.name)
    if (!name) return done("empty", null, PROFILE)
    try {
      const socials = await readSocials({ name, address: str(input.address) ?? "", website: str(input.website) ?? null })
      if (socials.instagram || socials.networks.length) return done("ok", socials, PROFILE)
      // Nothing found: a provider failure is reported as such, never as "the business has no accounts".
      if (socials.instagramFailure) return failure(socials.instagramFailure, PROFILE)
      return done("empty", socials, PROFILE)
    } catch (e) {
      return failure(classifyError(e), PROFILE)
    }
  },
  summarize(r) {
    const d = r.data as { instagram?: { handle?: string; followers?: number | null } | null; networks?: unknown[] } | null
    if (!d) return undefined
    const ig = d.instagram?.handle ? `@${d.instagram.handle}` : null
    const others = d.networks?.length ? `${d.networks.length} red(es) más` : null
    return [ig, others].filter(Boolean).join(" · ") || undefined
  },
}
