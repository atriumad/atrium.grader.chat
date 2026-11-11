import { findBusiness, findCandidates, findCompetitors, getPlace, type Place } from "@/lib/places"
import { decide } from "@/lib/match"
import { readSocials } from "@atrium/sources/read-socials"
import {
  findSocialLinks,
  getNetworkStats,
  getInstagramSnapshot,
  getInstagramStats,
  parseInstagramInput,
  type InstagramExtras,
} from "@/lib/socials"
import { agentEnabled, researchViaAgent, type AgentResearch } from "@/lib/agent-client"
import { groupByAccount, groupNote, hasAccounts, type Grouped } from "@/lib/competitors"
import { streamAnalysis, type Dataset, type Entity } from "@/lib/analysis"
import { getAgent, getScoring } from "@/lib/admin/config"
import { pinnedKnowledge } from "@/lib/admin/knowledge"
import { logEvent, saveAnalysis, startLookupContext } from "@/lib/admin/log"
import { allow, clientKey } from "@/lib/rate-limit"
import { db, supabaseConfigured } from "@/lib/supabase/server"
import { activateScoring, scoreAll, serializeScoreConfig } from "@/lib/metrics"

export const maxDuration = 120

const MAX_COMPETITORS_WITH_SOCIAL = 3

type Event =
  | { type: "status" | "text" | "error"; text: string }
  | { type: "data"; data: Dataset }
  | { type: "choices"; reason: "multiple" | "confirm" | "typo"; text: string; options: Place[] }
  // One unit of research, shown on the scan screen. `meta` is a real value found (never a guess).
  | { type: "step"; id: string; label: string; state: "running" | "done" | "skipped"; meta?: string }

const fmtCount = (n: number) => new Intl.NumberFormat("en-US", { notation: "compact", maximumFractionDigits: 1 }).format(n)
const errMsg = (e: unknown) => (e instanceof Error ? e.message : "error")

function host(url: string | null | undefined): string | null {
  if (!url) return null
  try {
    return new URL(url.startsWith("http") ? url : `https://${url}`).hostname.replace(/^www\./, "")
  } catch {
    return null
  }
}

function norm(s: string): string {
  return s.toLowerCase().normalize("NFD").replace(/[̀-ͯ]/g, "").replace(/[^a-z0-9]+/g, " ").trim()
}

// A Google result only counts as "the same business" if its website matches the
// Instagram profile link, or the names match closely.
function isSameBusiness(place: Place, extras: InstagramExtras, handle: string): boolean {
  const a = host(place.website)
  const b = host(extras.externalUrl)
  if (a && b && a === b) return true
  const pn = norm(place.name)
  const names = [extras.fullName, handle].filter(Boolean).map((n) => norm(n as string))
  return names.some((n) => n.length >= 4 && (n === pn || pn.includes(n) || n.includes(pn)))
}

// Reads the social networks of a business (website links first, then a name-validated search).
async function socialsFromWebsiteUncached(place: Place, instagramOnly = false): Promise<Pick<Entity, "instagram" | "instagramNote" | "networks" | "networksNote">> {
  const { instagram, instagramNote, networks, networksNote } = await readSocials(place, { instagramOnly })
  return { instagram, instagramNote, networks, networksNote }
}

type Socials = Awaited<ReturnType<typeof socialsFromWebsiteUncached>>
// `instagramOnly` is for competitors: Instagram is enough to compare and other networks are billed.
type Reader = (place: Place, instagramOnly?: boolean) => Promise<Entity>

// One reader per request: two locations with the same website are read (and billed) once.
function makeReader(): Reader {
  const cache = new Map<string, Promise<Socials>>()
  return async (place, instagramOnly = false) => {
    const key = `${instagramOnly ? "ig:" : "all:"}${host(place.website) ?? `place:${place.id}`}`
    let socials = cache.get(key)
    if (!socials) {
      socials = socialsFromWebsiteUncached(place, instagramOnly)
      cache.set(key, socials)
    }
    return { name: place.name, place, ...(await socials) }
  }
}

// Reads competitors until MAX_COMPETITORS_WITH_SOCIAL distinct accounts are found (or the
// places run out), so duplicate locations do not use up the slots.
async function analyzeCompetitors(
  business: Promise<Entity>,
  places: Place[],
  read: Reader
): Promise<{ competitors: Entity[]; grouped: Grouped }> {
  const analyzed: Entity[] = []
  let cursor = 0
  let need = MAX_COMPETITORS_WITH_SOCIAL
  let grouped: Grouped = { competitors: [], sameBrandAsBusiness: 0, merged: 0 }
  while (need > 0 && cursor < places.length) {
    const batch = places.slice(cursor, cursor + need)
    cursor += batch.length
    const [biz, entities] = await Promise.all([business, Promise.all(batch.map((p) => read(p, true)))])
    analyzed.push(...entities)
    grouped = groupByAccount(biz, analyzed)
    need = MAX_COMPETITORS_WITH_SOCIAL - grouped.competitors.filter(hasAccounts).length
  }
  const rest: Entity[] = places
    .slice(cursor)
    .map((p) => ({ name: p.name, place: p, instagram: null, instagramNote: "Not analyzed" }))
  if (!analyzed.length) grouped = groupByAccount(await business, [])
  return { competitors: [...grouped.competitors, ...rest], grouped }
}

async function entityFromHandle(handle: string): Promise<Entity> {
  try {
    return { name: `@${handle}`, place: null, instagram: await getInstagramStats(handle), instagramNote: "ok" }
  } catch (e) {
    return { name: `@${handle}`, place: null, instagram: null, instagramNote: `Unavailable: ${errMsg(e)}` }
  }
}

// Every analysis spends paid provider credits, so abuse is capped per visitor and per day overall.
const DAILY_CAP = Number(process.env.ANALYZE_DAILY_CAP ?? 400)

async function overDailyCap(): Promise<boolean> {
  if (!supabaseConfigured() || !(DAILY_CAP > 0)) return false
  const since = new Date(Date.now() - 86_400_000).toISOString()
  const { count, error } = await db().from("analyses").select("id", { count: "exact", head: true }).gte("created_at", since)
  return !error && (count ?? 0) >= DAILY_CAP
}

export async function POST(req: Request) {
  if (!allow(`analyze:${clientKey(req)}`, 6, 10 * 60_000)) {
    return Response.json({ error: "Too many analyses in a short time. Please wait a few minutes." }, { status: 429 })
  }
  if (await overDailyCap()) {
    return Response.json({ error: "We have reached today's capacity. Please try again tomorrow." }, { status: 503 })
  }
  const body = (await req.json().catch(() => null)) as { query?: string; placeId?: string; depth?: string } | null
  // "basic" reads only Instagram (cheap, for anonymous visitors); anything else is the full analysis.
  const basic = body?.depth === "basic"
  const query = body?.query?.trim()
  const placeId = typeof body?.placeId === "string" ? body.placeId : null
  if (!query || query.length > 200) {
    return Response.json({ error: "Type the business name (and city) or its Instagram @" }, { status: 400 })
  }

  const encoder = new TextEncoder()
  const stream = new ReadableStream({
    async start(controller) {
      const send = (e: Event) => controller.enqueue(encoder.encode(JSON.stringify(e) + "\n"))
      const t0 = Date.now()
      const lookupCtx = startLookupContext(query)
      const step = (id: string, label: string, state: "running" | "done" | "skipped", meta?: string) =>
        send({ type: "step", id, label, state, meta })
      const placeMeta = (p: Place | null) =>
        p ? [p.rating != null ? `${p.rating.toFixed(1)}★` : null, p.reviews != null ? `${p.reviews} reviews` : null].filter(Boolean).join(" · ") || undefined : undefined
      try {
        // Rules published in the admin panel (defaults if none or Supabase is down).
        const [scoring, agent, pinned] = await Promise.all([getScoring(), getAgent(), pinnedKnowledge()])
        activateScoring(scoring.config)
        const handle = parseInstagramInput(query)
        let data: Dataset

        if (handle) {
          // ---- Mode A: starts from the Instagram account ----
          send({ type: "status", text: `Reading the Instagram profile of @${handle}...` })
          step("instagram", `Reading the profile of @${handle}`, "running")
          let snapshot
          try {
            snapshot = await getInstagramSnapshot(handle)
          } catch (e) {
            send({ type: "error", text: `I could not read @${handle}: ${errMsg(e)}. Is it public and spelled correctly?` })
            return
          }
          const { stats, extras } = snapshot
          step("instagram", `Profile of @${handle} read`, "done", stats.followers != null ? `${fmtCount(stats.followers)} followers` : undefined)
          const displayName = extras.fullName ?? `@${handle}`
          lookupCtx.business = displayName

          // Try to attach a Google listing, but only if it is verifiably the same business.
          let place: Place | null = null
          const location = [extras.street, extras.city].filter(Boolean).join(" ")
          if (location || extras.externalUrl) {
            send({ type: "status", text: `Looking up ${displayName} on Google Maps...` })
            step("google", "Looking up its Google listing", "running")
            try {
              const candidate = await findBusiness(`${displayName} ${extras.city ?? ""}`.trim())
              if (candidate && isSameBusiness(candidate, extras, handle)) place = candidate
            } catch {
              // Google lookup is optional in this mode.
            }
            if (place) step("google", "Google listing read", "done", placeMeta(place))
            else step("google", "No Google listing confirmed", "skipped")
          } else {
            step("google", "No location to search on Google", "skipped")
          }

          // Other networks come from the business website (Google listing, else the IG profile link).
          send({ type: "status", text: "Looking for its other social networks (Facebook, TikTok, YouTube)..." })
          step("networks", "Looking for its other networks", "running")
          const others = await getNetworkStats(await findSocialLinks(place?.website ?? extras.externalUrl))
          step("networks", others.networks.length ? "Other networks read" : "No other networks found", others.networks.length ? "done" : "skipped", others.networks.length ? others.networks.map((n) => n.network).join(", ") : undefined)
          const business: Entity = {
            name: displayName,
            place,
            instagram: stats,
            instagramNote: "ok",
            networks: others.networks,
            networksNote: others.note,
          }
          let competitors: Entity[]
          let competitorsSource: string
          let groupedNote = ""

          if (place) {
            send({ type: "status", text: "Found its Google listing. Looking for nearby competitors..." })
            step("competitors", "Looking for nearby competitors", "running")
            const near = await findCompetitors(place)
            step("competitors", "Competitors found", "done", `${near.length} within 1.9 mi`)
            send({ type: "status", text: "Reading the competitors' social networks..." })
            step("rivals", "Reading the competitors' networks", "running")
            const result = await analyzeCompetitors(Promise.resolve(business), near, makeReader())
            step("rivals", "Competitors' networks read", "done", `${result.competitors.filter(hasAccounts).length} with accounts`)
            competitors = result.competitors
            groupedNote = groupNote(result.grouped)
            competitorsSource = `nearby businesses of the same type on Google Maps (within 1.9 miles)${groupedNote}`
          } else {
            send({ type: "status", text: "No Google listing confirmed. Using similar Instagram accounts..." })
            competitors = await Promise.all(
              extras.related.slice(0, MAX_COMPETITORS_WITH_SOCIAL).map((h) => entityFromHandle(h))
            )
            competitorsSource =
              "similar accounts suggested by Instagram (they may not be direct competitors)"
          }

          data = {
            mode: "instagram_handle",
            queried: query,
            identification: `Instagram account @${handle}${extras.fullName ? ` (${extras.fullName})` : ""}${
              place ? `, with a confirmed Google listing: ${place.name}, ${place.address}` : ", no Google listing confirmed"
            }`,
            business,
            competitorsSource,
            competitors,
            generatedAt: new Date().toISOString(),
          }
        } else {
          // ---- Mode B: starts from the business name ----
          // With ANALYZE_VIA_AGENT=1 the research service does the lookups; if it is off, fails, or
          // cannot pick one location, the grader's own flow below runs as before.
          let viaAgent: AgentResearch | null = null
          if (agentEnabled()) {
            send({ type: "status", text: "Researching your business..." })
            viaAgent = await researchViaAgent(placeId ? { placeId } : { name: query }, (s) => {
              if (s.id === "google" || s.id === "competitors") step(s.id, s.label, s.state === "running" ? "running" : s.state === "skipped" ? "skipped" : "done", s.meta)
              else if (s.id === "social" || s.id.startsWith("rival-")) step("social", "Reading the social networks of your business and its competitors", "running")
            }, basic ? "basic" : "full")
          }
          if (viaAgent) {
            step("social", "Social networks read", "done", `${[viaAgent.business, ...viaAgent.competitors].filter(hasAccounts).length} businesses with accounts`)
            lookupCtx.business = viaAgent.business.name
            data = {
              mode: "business_name",
              queried: query,
              identification: placeId
                ? `Business picked by the user on Google Maps: ${viaAgent.business.place?.name}, ${viaAgent.business.place?.address}`
                : `Clear match on Google Maps for "${query}": ${viaAgent.business.place?.name}, ${viaAgent.business.place?.address}`,
              business: viaAgent.business,
              competitorsSource: `nearby businesses of the same type on Google Maps (within 1.9 miles)${viaAgent.note}`,
              competitors: viaAgent.competitors,
              generatedAt: new Date().toISOString(),
            }
          } else {
            let business: Place | null = null
            let pickedByUser = false

            if (placeId) {
              // The user already chose a specific location from the list.
              send({ type: "status", text: "Opening the business you picked..." })
              business = await getPlace(placeId)
              pickedByUser = true
              if (!business) {
                send({ type: "error", text: "I could not open that business. Please search for it again." })
                return
              }
            } else {
              send({ type: "status", text: "Looking for your business on Google..." })
              const candidates = await findCandidates(query, 5)
              const decision = decide(query, candidates)
              if (decision.action === "none") {
                send({ type: "error", text: "I could not find that business. Try the name and city, or its Instagram @." })
                return
              }
              if (decision.action === "ask") {
                send({ type: "choices", reason: decision.reason, text: decision.message, options: decision.options })
                return
              }
              business = decision.place
            }
            send({ type: "status", text: `Found: ${business.name} (${business.address}). Looking for competitors...` })
            step("google", "Google listing read", "done", placeMeta(business))
            lookupCtx.business = business.name
            step("competitors", "Looking for nearby competitors", "running")
            const competitorPlaces = await findCompetitors(business)
            step("competitors", "Competitors found", "done", `${competitorPlaces.length} within 1.9 mi`)

            send({ type: "status", text: "Reading the social networks of your business and its competitors..." })
            step("social", "Reading the social networks of your business and its competitors", "running")
            const read = makeReader()
            const businessPromise = read(business, basic)
            const [businessEntity, result] = await Promise.all([
              businessPromise,
              analyzeCompetitors(businessPromise, competitorPlaces, read),
            ])
            const competitorEntities = result.competitors
            const withAccounts = [businessEntity, ...competitorEntities].filter(hasAccounts).length
            step("social", "Social networks read", "done", `${withAccounts} businesses with accounts`)

            data = {
              mode: "business_name",
              queried: query,
              identification: pickedByUser
                ? `Business picked by the user on Google Maps: ${business.name}, ${business.address}`
                : `Clear match on Google Maps for "${query}": ${business.name}, ${business.address}`,
              business: businessEntity,
              competitorsSource: `nearby businesses of the same type on Google Maps (within 1.9 miles)${groupNote(result.grouped)}`,
              competitors: competitorEntities,
              generatedAt: new Date().toISOString(),
            }

          }
        }

        if (scoring.custom) data.scoring = serializeScoreConfig(scoring.config)
        send({ type: "data", data })
        send({ type: "status", text: "Analyzing the data..." })
        step("analysis", "Writing the diagnosis", "running")
        for await (const chunk of streamAnalysis(data, {
          tone: agent.config.tone,
          instructions: agent.config.analysisInstructions,
          knowledge: pinned,
        })) {
          send({ type: "text", text: chunk })
        }
        step("analysis", "Diagnosis ready", "done")
        saveAnalysis({
          query,
          data,
          score: scoreAll(data)[0]?.total ?? null,
          source: req.headers.get("x-atrium-source") === "mobile" ? "mobile" : "web",
          durationMs: Date.now() - t0,
        })
      } catch (e) {
        logEvent("analysis_error", { query: query.slice(0, 120), error: errMsg(e).slice(0, 200) })
        send({ type: "error", text: errMsg(e) })
      } finally {
        controller.close()
      }
    },
  })

  return new Response(stream, {
    headers: { "Content-Type": "application/x-ndjson; charset=utf-8", "Cache-Control": "no-store" },
  })
}
