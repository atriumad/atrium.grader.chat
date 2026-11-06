import { findBusiness, findCandidates, findCompetitors, getPlace, type Place } from "@/lib/places"
import { decide } from "@/lib/match"
import {
  findInstagramHandle,
  getInstagramSnapshot,
  getInstagramStats,
  parseInstagramInput,
  type InstagramExtras,
} from "@/lib/socials"
import { streamAnalysis, type Dataset, type Entity } from "@/lib/analysis"

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

async function entityFromPlace(place: Place): Promise<Entity> {
  const handle = await findInstagramHandle(place.website)
  if (!handle) {
    return { name: place.name, place, instagram: null, instagramNote: "No se encontró Instagram en su sitio web" }
  }
  try {
    return { name: place.name, place, instagram: await getInstagramStats(handle), instagramNote: "ok" }
  } catch (e) {
    return {
      name: place.name,
      place,
      instagram: null,
      instagramNote: `Instagram @${handle} no disponible: ${errMsg(e)}`,
    }
  }
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
      try {
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

          const business: Entity = { name: displayName, place, instagram: stats, instagramNote: "ok" }
          let competitors: Entity[]
          let competitorsSource: string

          if (place) {
            send({ type: "status", text: "Encontré su ficha de Google. Buscando competidores cercanos..." })
            const near = await findCompetitors(place)
            send({ type: "status", text: "Leyendo Instagram de la competencia..." })
            competitors = await Promise.all(
              near.map((p, i) =>
                i < MAX_COMPETITORS_WITH_SOCIAL
                  ? entityFromPlace(p)
                  : Promise.resolve<Entity>({ name: p.name, place: p, instagram: null, instagramNote: "No analizado" })
              )
            )
            competitorsSource = "negocios cercanos del mismo tipo en Google Maps (radio 3 km)"
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

          send({ type: "status", text: "Leyendo Instagram de tu negocio y de la competencia..." })
          const [businessEntity, ...competitorEntities] = await Promise.all([
            entityFromPlace(business),
            ...competitorPlaces.map((p, i) =>
              i < MAX_COMPETITORS_WITH_SOCIAL
                ? entityFromPlace(p)
                : Promise.resolve<Entity>({ name: p.name, place: p, instagram: null, instagramNote: "No analizado" })
            ),
          ])

          data = {
            mode: "business_name",
            queried: query,
            identification: pickedByUser
              ? `Local elegido por el usuario en Google Maps: ${business.name}, ${business.address}`
              : `Coincidencia clara en Google Maps para "${query}": ${business.name}, ${business.address}`,
            business: businessEntity,
            competitorsSource: "negocios cercanos del mismo tipo en Google Maps (radio 3 km)",
            competitors: competitorEntities,
            generatedAt: new Date().toISOString(),
          }
        }

        send({ type: "data", data })
        send({ type: "status", text: "Analizando los datos..." })
        for await (const chunk of streamAnalysis(data)) {
          send({ type: "text", text: chunk })
        }
      } catch (e) {
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
