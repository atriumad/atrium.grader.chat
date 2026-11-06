import { findBusiness, findCandidates, findCompetitors, getPlace, type Place } from "@/lib/places"
import { decide } from "@/lib/match"
import {
  findSocialLinks,
  getNetworkStats,
  getInstagramSnapshot,
  getInstagramStats,
  parseInstagramInput,
  type InstagramExtras,
} from "@/lib/socials"
import { groupByAccount, groupNote, hasAccounts, type Grouped } from "@/lib/competitors"
import { streamAnalysis, type Dataset, type Entity } from "@/lib/analysis"
import { getAgent, getScoring } from "@/lib/admin/config"
import { pinnedKnowledge } from "@/lib/admin/knowledge"
import { logEvent, saveAnalysis } from "@/lib/admin/log"
import { activateScoring, scoreAll, serializeScoreConfig } from "@/lib/metrics"

export const maxDuration = 120

const MAX_COMPETITORS_WITH_SOCIAL = 3

type Event =
  | { type: "status" | "text" | "error"; text: string }
  | { type: "data"; data: Dataset }
  | { type: "choices"; reason: "multiple" | "confirm" | "typo"; text: string; options: Place[] }

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

// Reads every social network linked from a website. Instagram is the anchor; the
// other networks add to it when the business has them.
async function socialsFromWebsiteUncached(website: string | null): Promise<Pick<Entity, "instagram" | "instagramNote" | "networks" | "networksNote">> {
  const links = await findSocialLinks(website)
  const [instagram, others] = await Promise.all([
    links.instagram
      ? getInstagramStats(links.instagram).then(
          (s) => ({ instagram: s, instagramNote: "ok" }),
          (e) => ({ instagram: null, instagramNote: `Instagram @${links.instagram} no disponible: ${errMsg(e)}` })
        )
      : Promise.resolve({ instagram: null, instagramNote: "No se encontró Instagram en su sitio web" }),
    getNetworkStats(links),
  ])
  return { ...instagram, networks: others.networks, networksNote: others.note }
}

type Socials = Awaited<ReturnType<typeof socialsFromWebsiteUncached>>
type Reader = (place: Place) => Promise<Entity>

// One reader per request: two locations with the same website are read (and billed) once.
function makeReader(): Reader {
  const cache = new Map<string, Promise<Socials>>()
  return async (place) => {
    const key = host(place.website) ?? `place:${place.id}`
    let socials = cache.get(key)
    if (!socials) {
      socials = socialsFromWebsiteUncached(place.website)
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
    const [biz, entities] = await Promise.all([business, Promise.all(batch.map(read))])
    analyzed.push(...entities)
    grouped = groupByAccount(biz, analyzed)
    need = MAX_COMPETITORS_WITH_SOCIAL - grouped.competitors.filter(hasAccounts).length
  }
  const rest: Entity[] = places
    .slice(cursor)
    .map((p) => ({ name: p.name, place: p, instagram: null, instagramNote: "No analizado" }))
  if (!analyzed.length) grouped = groupByAccount(await business, [])
  return { competitors: [...grouped.competitors, ...rest], grouped }
}

async function entityFromHandle(handle: string): Promise<Entity> {
  try {
    return { name: `@${handle}`, place: null, instagram: await getInstagramStats(handle), instagramNote: "ok" }
  } catch (e) {
    return { name: `@${handle}`, place: null, instagram: null, instagramNote: `No disponible: ${errMsg(e)}` }
  }
}

export async function POST(req: Request) {
  const body = (await req.json().catch(() => null)) as { query?: string; placeId?: string } | null
  const query = body?.query?.trim()
  const placeId = typeof body?.placeId === "string" ? body.placeId : null
  if (!query || query.length > 200) {
    return Response.json({ error: "Escribe el nombre del negocio (y la ciudad) o su @ de Instagram" }, { status: 400 })
  }

  const encoder = new TextEncoder()
  const stream = new ReadableStream({
    async start(controller) {
      const send = (e: Event) => controller.enqueue(encoder.encode(JSON.stringify(e) + "\n"))
      const t0 = Date.now()
      try {
        // Rules published in the admin panel (defaults if none or Supabase is down).
        const [scoring, agent, pinned] = await Promise.all([getScoring(), getAgent(), pinnedKnowledge()])
        activateScoring(scoring.config)
        const handle = parseInstagramInput(query)
        let data: Dataset

        if (handle) {
          // ---- Mode A: starts from the Instagram account ----
          send({ type: "status", text: `Leyendo el perfil de @${handle} en Instagram...` })
          let snapshot
          try {
            snapshot = await getInstagramSnapshot(handle)
          } catch (e) {
            send({ type: "error", text: `No pude leer @${handle}: ${errMsg(e)}. ¿Es público y está bien escrito?` })
            return
          }
          const { stats, extras } = snapshot
          const displayName = extras.fullName ?? `@${handle}`

          // Try to attach a Google listing, but only if it is verifiably the same business.
          let place: Place | null = null
          const location = [extras.street, extras.city].filter(Boolean).join(" ")
          if (location || extras.externalUrl) {
            send({ type: "status", text: `Buscando ${displayName} en Google Maps...` })
            try {
              const candidate = await findBusiness(`${displayName} ${extras.city ?? ""}`.trim())
              if (candidate && isSameBusiness(candidate, extras, handle)) place = candidate
            } catch {
              // Google lookup is optional in this mode.
            }
          }

          // Other networks come from the business website (Google listing, else the IG profile link).
          send({ type: "status", text: "Buscando sus otras redes sociales (Facebook, TikTok, YouTube)..." })
          const others = await getNetworkStats(await findSocialLinks(place?.website ?? extras.externalUrl))
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
            send({ type: "status", text: "Encontré su ficha de Google. Buscando competidores cercanos..." })
            const near = await findCompetitors(place)
            send({ type: "status", text: "Leyendo las redes sociales de la competencia..." })
            const result = await analyzeCompetitors(Promise.resolve(business), near, makeReader())
            competitors = result.competitors
            groupedNote = groupNote(result.grouped)
            competitorsSource = `negocios cercanos del mismo tipo en Google Maps (radio 3 km)${groupedNote}`
          } else {
            send({ type: "status", text: "Sin ficha de Google confirmada. Usando cuentas similares de Instagram..." })
            competitors = await Promise.all(
              extras.related.slice(0, MAX_COMPETITORS_WITH_SOCIAL).map((h) => entityFromHandle(h))
            )
            competitorsSource =
              "cuentas similares sugeridas por Instagram (pueden no ser competidores directos)"
          }

          data = {
            mode: "instagram_handle",
            queried: query,
            identification: `Cuenta de Instagram @${handle}${extras.fullName ? ` (${extras.fullName})` : ""}${
              place ? `, con ficha de Google confirmada: ${place.name}, ${place.address}` : ", sin ficha de Google confirmada"
            }`,
            business,
            competitorsSource,
            competitors,
            generatedAt: new Date().toISOString(),
          }
        } else {
          // ---- Mode B: starts from the business name (Google Places) ----
          let business: Place | null = null
          let pickedByUser = false

          if (placeId) {
            // The user already chose a specific location from the list.
            send({ type: "status", text: "Abriendo el local que elegiste..." })
            business = await getPlace(placeId)
            pickedByUser = true
            if (!business) {
              send({ type: "error", text: "No pude abrir ese local. Vuelve a buscarlo." })
              return
            }
          } else {
            send({ type: "status", text: "Buscando tu negocio en Google..." })
            const candidates = await findCandidates(query, 5)
            const decision = decide(query, candidates)
            if (decision.action === "none") {
              send({ type: "error", text: "No encontré ese negocio. Prueba con nombre y ciudad, o con su @ de Instagram." })
              return
            }
            if (decision.action === "ask") {
              send({ type: "choices", reason: decision.reason, text: decision.message, options: decision.options })
              return
            }
            business = decision.place
          }
          send({ type: "status", text: `Encontré: ${business.name} (${business.address}). Buscando competidores...` })
          const competitorPlaces = await findCompetitors(business)

          send({ type: "status", text: "Leyendo las redes sociales de tu negocio y de la competencia..." })
          const read = makeReader()
          const businessPromise = read(business)
          const [businessEntity, result] = await Promise.all([
            businessPromise,
            analyzeCompetitors(businessPromise, competitorPlaces, read),
          ])
          const competitorEntities = result.competitors

          data = {
            mode: "business_name",
            queried: query,
            identification: pickedByUser
              ? `Local elegido por el usuario en Google Maps: ${business.name}, ${business.address}`
              : `Coincidencia clara en Google Maps para "${query}": ${business.name}, ${business.address}`,
            business: businessEntity,
            competitorsSource: `negocios cercanos del mismo tipo en Google Maps (radio 3 km)${groupNote(result.grouped)}`,
            competitors: competitorEntities,
            generatedAt: new Date().toISOString(),
          }
        }

        if (scoring.custom) data.scoring = serializeScoreConfig(scoring.config)
        send({ type: "data", data })
        send({ type: "status", text: "Analizando los datos..." })
        for await (const chunk of streamAnalysis(data, {
          tone: agent.config.tone,
          instructions: agent.config.analysisInstructions,
          knowledge: pinned,
        })) {
          send({ type: "text", text: chunk })
        }
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
