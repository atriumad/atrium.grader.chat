// Live lookups the chat agent can run: fresh social numbers, Google reputation,
// a website SEO check and Google search ranking. Read-only; each returns compact JSON.

import type { Dataset } from "@/lib/analysis"
import { findBusiness } from "@/lib/places"
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
          if (!HANDLE.test(h)) throw new Error("No hay usuario de Instagram para ese negocio.")
          return getInstagramStats(h)
        })()
      : await (async () => {
          const known = entity.networks?.find((n) => n.network === network)?.handle
          const ref = given || known || ""
          if (!ref) throw new Error(`No se encontró una cuenta de ${network} para ese negocio.`)
          if (network === "tiktok") {
            if (!HANDLE.test(ref)) throw new Error("Usuario de TikTok no válido.")
            return getTikTokStats(ref.replace(/^@/, ""))
          }
          if (network === "facebook") {
            if (!/^https:\/\/(www\.)?facebook\.com\//i.test(ref)) throw new Error("Pasa la URL de Facebook completa.")
            return getFacebookStats(ref)
          }
          if (network === "youtube") {
            if (!/^https:\/\/(www\.)?youtube\.com\//i.test(ref)) throw new Error("Pasa la URL del canal de YouTube.")
            return getYouTubeStats(ref)
          }
          throw new Error("Red no soportada.")
        })()
  // What the diagnostic had, so the model can compare and flag differences.
  const before =
    network === "instagram"
      ? entity.instagram && { seguidores: entity.instagram.followers, engagementPct: entity.instagram.engagementRatePct }
      : entity.networks?.find((n) => n.network === network) &&
        (({ followers, engagementRatePct }) => ({ seguidores: followers, engagementPct: engagementRatePct }))(
          entity.networks!.find((n) => n.network === network)!
        )
  return { negocio: entity.name, red: network, ahora: stats, enElDiagnostico: before ?? null }
}

// ---- 2. Google reputation, live ----------------------------------------------

export async function liveGoogle(d: Dataset, input: Record<string, unknown>) {
  const entity = findEntity(d, input.business)
  const p = await findBusiness(`${entity.name} ${entity.place?.address ?? ""}`.trim())
  if (!p) return { negocio: entity.name, resultado: "No se encontró en Google Maps." }
  return {
    negocio: p.name,
    direccion: p.address,
    rating: p.rating,
    resenas: p.reviews,
    sitioWeb: p.website,
    enElDiagnostico: entity.place ? { rating: entity.place.rating, resenas: entity.place.reviews } : null,
  }
}

// ---- 3. SEO check of a business website ---------------------------------------

function meta(html: string, attr: string, name: string): string | null {
  const re = new RegExp(`<meta[^>]+${attr}=["']${name}["'][^>]*>`, "i")
  const tag = html.match(re)?.[0]
  return tag?.match(/content=["']([^"']*)["']/i)?.[1]?.trim() || null
}

export async function seoAudit(d: Dataset, input: Record<string, unknown>) {
  const entity = findEntity(d, input.business)
  const site = entity.place?.website
  if (!site) return { negocio: entity.name, resultado: "El negocio no tiene sitio web en Google Maps." }
  // Only sites that came from the analysis: the model cannot point this at arbitrary URLs.
  const allowed = new Set(entities(d).map((e) => (e.place?.website ? hostOf(e.place.website) : null)).filter(Boolean))
  const host = hostOf(site)
  if (!host || !allowed.has(host)) return { resultado: "Sitio no permitido." }
  const t0 = Date.now()
  const res = await fetch(site, {
    signal: AbortSignal.timeout(8_000),
    headers: { "User-Agent": "Mozilla/5.0 (compatible; AtriumGrader/0.1)" },
    redirect: "follow",
  })
  const ms = Date.now() - t0
  if (hostOf(res.url) !== host) return { negocio: entity.name, resultado: `El sitio redirige a otro dominio (${hostOf(res.url)}).` }
  const html = (await res.text()).slice(0, 600_000)
  const text = html.replace(/<script[\s\S]*?<\/script>|<style[\s\S]*?<\/style>|<[^>]+>/g, " ")
  const jsonLd = [...html.matchAll(/<script[^>]+application\/ld\+json[^>]*>([\s\S]*?)<\/script>/gi)].map((m) => m[1])
  const schemaTypes = [...new Set(jsonLd.join(" ").match(/"@type"\s*:\s*"([A-Za-z]+)"/g)?.map((s) => s.replace(/.*:\s*"|"/g, "")) ?? [])]
  const robots = await fetch(new URL("/robots.txt", res.url), { signal: AbortSignal.timeout(4_000) }).then((r) => (r.ok ? r.text() : "")).catch(() => "")
  const sitemap = await fetch(new URL("/sitemap.xml", res.url), { signal: AbortSignal.timeout(4_000) }).then((r) => r.ok).catch(() => false)
  const title = html.match(/<title[^>]*>([\s\S]*?)<\/title>/i)?.[1]?.trim() ?? null
  const desc = meta(html, "name", "description")
  const h1s = [...html.matchAll(/<h1[^>]*>([\s\S]*?)<\/h1>/gi)].map((m) => m[1].replace(/<[^>]+>/g, "").trim()).filter(Boolean)
  const city = (entity.place?.address ?? "").split(",")[1]?.trim().toLowerCase()
  return {
    negocio: entity.name,
    url: res.url,
    https: res.url.startsWith("https://"),
    status: res.status,
    tiempoRespuestaMs: ms,
    pesoHtmlKB: Math.round(html.length / 1024),
    title: title && { texto: title, largo: title.length, mencionaCiudad: city ? title.toLowerCase().includes(city) : null },
    metaDescription: desc && { texto: desc, largo: desc.length },
    h1: h1s.slice(0, 3),
    canonical: html.match(/<link[^>]+rel=["']canonical["'][^>]*href=["']([^"']+)/i)?.[1] ?? null,
    viewportMovil: /<meta[^>]+name=["']viewport["']/i.test(html),
    noindex: /<meta[^>]+name=["']robots["'][^>]+noindex/i.test(html),
    openGraph: { titulo: !!meta(html, "property", "og:title"), imagen: !!meta(html, "property", "og:image") },
    datosEstructurados: schemaTypes,
    tieneSchemaRestaurante: schemaTypes.some((t) => /Restaurant|LocalBusiness|FoodEstablishment|CafeOrCoffeeShop|Bakery|BarOrPub/.test(t)),
    sitemapXml: sitemap,
    robotsTxt: robots ? (/^\s*disallow:\s*\/\s*$/im.test(robots) ? "bloquea todo" : "ok") : "no encontrado",
    contenido: {
      palabras: text.split(/\s+/).filter(Boolean).length,
      menuEnLaPagina: /\b(menu|men[uú]|carta)\b/i.test(text),
      telefono: /(\+?\d[\d\s().-]{8,}\d)/.test(text),
      imagenesSinAlt: (html.match(/<img\b(?![^>]*\balt=["'][^"']+["'])[^>]*>/gi) ?? []).length,
    },
    nota: "Es una revisión de la portada, no una auditoría completa del sitio ni medición de velocidad real.",
  }
}

// ---- 4. Where the business shows up on Google ----------------------------------

export async function searchRanking(d: Dataset, input: Record<string, unknown>) {
  const query = String(input.query ?? "").trim().slice(0, 120)
  if (query.length < 3) throw new Error("Consulta muy corta.")
  const entity = findEntity(d, input.business)
  const data = await sc("/v1/google/search", { query, country: "us", language: "es" })
  const results: Array<{ title: string; url: string; description?: string }> = Array.isArray(data?.results) ? data.results : []
  const mine = new Set([entity.place?.website, ...(entity.networks ?? []).map(() => null)].map((u) => (u ? hostOf(u) : null)).filter(Boolean))
  const compHosts = new Map(d.competitors.map((c) => [c.place?.website ? hostOf(c.place.website) : null, c.name] as const))
  const rows = results.map((r, i) => {
    const h = hostOf(r.url)
    return {
      posicion: i + 1,
      titulo: r.title,
      dominio: h,
      esElNegocio: !!h && mine.has(h),
      competidor: (h && compHosts.get(h)) || undefined,
    }
  })
  const pos = rows.find((r) => r.esElNegocio)?.posicion ?? null
  return {
    consulta: query,
    negocio: entity.name,
    posicionDelSitioDelNegocio: pos,
    nota: pos ? undefined : "No aparece en los primeros 10 resultados orgánicos de esta consulta (sin Google Maps ni resultados locales).",
    top10: rows,
  }
}
