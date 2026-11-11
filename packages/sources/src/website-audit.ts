// Home-page SEO check of a business website. Shared by the chat (apps/web) and the research agent.
// It reads the home page only: not a full-site audit and not a real speed measurement.

export function hostOf(u: string): string | null {
  try {
    return new URL(/^https?:\/\//i.test(u) ? u : `https://${u}`).hostname.replace(/^www\./, "").toLowerCase()
  } catch {
    return null
  }
}

// Hosts that must never be fetched on behalf of a caller (loopback, private ranges, metadata service).
export function isPrivateHost(host: string): boolean {
  const h = host.replace(/^\[|\]$/g, "").toLowerCase()
  if (h === "localhost" || h.endsWith(".localhost") || h.endsWith(".local") || h.endsWith(".internal")) return true
  if (h.includes(":")) return h === "::1" || h.startsWith("fc") || h.startsWith("fd") || h.startsWith("fe80") || h.startsWith("::ffff:")
  const m = h.match(/^(\d+)\.(\d+)\.(\d+)\.(\d+)$/)
  if (!m) return false
  const [a, b] = [Number(m[1]), Number(m[2])]
  return a === 0 || a === 10 || a === 127 || (a === 169 && b === 254) || (a === 172 && b >= 16 && b <= 31) || (a === 192 && b === 168) || a >= 224
}

function meta(html: string, attr: string, name: string): string | null {
  const re = new RegExp(`<meta[^>]+${attr}=["']${name}["'][^>]*>`, "i")
  const tag = html.match(re)?.[0]
  return tag?.match(/content=["']([^"']*)["']/i)?.[1]?.trim() || null
}

export type WebsiteAuditOptions = {
  // Business name and city (taken from its address) make the title check meaningful.
  name?: string
  city?: string
  // When set, only these hosts can be audited and a redirect to any other host is refused.
  allowedHosts?: string[]
  signal?: AbortSignal
}

export type WebsiteAudit = Record<string, unknown>

const UA = { "User-Agent": "Mozilla/5.0 (compatible; AtriumGrader/0.1)" }
const timeout = (ms: number, signal?: AbortSignal) => (signal ? AbortSignal.any([AbortSignal.timeout(ms), signal]) : AbortSignal.timeout(ms))

// Returns a `resultado` message (no throw) when the site is refused; throws on network failure.
export async function auditWebsite(site: string, opts: WebsiteAuditOptions = {}): Promise<WebsiteAudit> {
  const host = hostOf(site)
  if (!host || isPrivateHost(host)) return { resultado: "Sitio no permitido." }
  if (opts.allowedHosts && !opts.allowedHosts.includes(host)) return { resultado: "Sitio no permitido." }
  const t0 = Date.now()
  const res = await fetch(site, { signal: timeout(8_000, opts.signal), headers: UA, redirect: "follow" })
  const ms = Date.now() - t0
  const finalHost = hostOf(res.url)
  if (finalHost !== host) return { negocio: opts.name, resultado: `El sitio redirige a otro dominio (${finalHost}).` }
  // An error page (often a bot wall) says nothing about the site: report it as unreadable, not as an audit.
  if (res.status >= 400) return { negocio: opts.name, status: res.status, resultado: `El sitio respondió ${res.status}; probablemente bloquea lectores automáticos, no se pudo revisar.` }
  const html = (await res.text()).slice(0, 600_000)
  const text = html.replace(/<script[\s\S]*?<\/script>|<style[\s\S]*?<\/style>|<[^>]+>/g, " ")
  const jsonLd = [...html.matchAll(/<script[^>]+application\/ld\+json[^>]*>([\s\S]*?)<\/script>/gi)].map((m) => m[1])
  const schemaTypes = [...new Set(jsonLd.join(" ").match(/"@type"\s*:\s*"([A-Za-z]+)"/g)?.map((s) => s.replace(/.*:\s*"|"/g, "")) ?? [])]
  const robots = await fetch(new URL("/robots.txt", res.url), { signal: timeout(4_000, opts.signal) }).then((r) => (r.ok ? r.text() : "")).catch(() => "")
  const sitemap = await fetch(new URL("/sitemap.xml", res.url), { signal: timeout(4_000, opts.signal) }).then((r) => r.ok).catch(() => false)
  const title = html.match(/<title[^>]*>([\s\S]*?)<\/title>/i)?.[1]?.trim() ?? null
  const desc = meta(html, "name", "description")
  const h1s = [...html.matchAll(/<h1[^>]*>([\s\S]*?)<\/h1>/gi)].map((m) => m[1].replace(/<[^>]+>/g, "").trim()).filter(Boolean)
  const city = opts.city?.trim().toLowerCase()
  return {
    negocio: opts.name,
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
