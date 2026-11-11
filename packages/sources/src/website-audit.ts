import { hostOf, isPrivateHost, safeFetch } from "./safe-fetch.ts"

// Home-page SEO check of a business website. Shared by the chat (apps/web) and the research agent.
// It reads the home page only: not a full-site audit and not a real speed measurement.

export { hostOf, isPrivateHost } from "./safe-fetch.ts"

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

// Returns a `result` message (no throw) when the site is refused; throws on network failure.
export async function auditWebsite(site: string, opts: WebsiteAuditOptions = {}): Promise<WebsiteAudit> {
  const host = hostOf(site)
  if (!host || isPrivateHost(host)) return { result: "Sitio no permitido." }
  if (opts.allowedHosts && !opts.allowedHosts.includes(host)) return { result: "Sitio no permitido." }
  const t0 = Date.now()
  const res = await safeFetch(site, { signal: timeout(8_000, opts.signal), headers: UA })
  const ms = Date.now() - t0
  const finalHost = hostOf(res.url)
  if (finalHost !== host) return { business: opts.name, result: `The site redirects to another domain (${finalHost}).` }
  // An error page (often a bot wall) says nothing about the site: report it as unreadable, not as an audit.
  if (res.status >= 400) return { business: opts.name, status: res.status, result: `The site responded ${res.status}; it probably blocks automated readers, so it could not be checked.` }
  const html = (await res.text()).slice(0, 600_000)
  const text = html.replace(/<script[\s\S]*?<\/script>|<style[\s\S]*?<\/style>|<[^>]+>/g, " ")
  const jsonLd = [...html.matchAll(/<script[^>]+application\/ld\+json[^>]*>([\s\S]*?)<\/script>/gi)].map((m) => m[1])
  const schemaTypes = [...new Set(jsonLd.join(" ").match(/"@type"\s*:\s*"([A-Za-z]+)"/g)?.map((s) => s.replace(/.*:\s*"|"/g, "")) ?? [])]
  const robots = await safeFetch(new URL("/robots.txt", res.url), { signal: timeout(4_000, opts.signal) }).then((r) => (r.ok ? r.text() : "")).catch(() => "")
  const sitemap = await safeFetch(new URL("/sitemap.xml", res.url), { signal: timeout(4_000, opts.signal) }).then((r) => r.ok).catch(() => false)
  const title = html.match(/<title[^>]*>([\s\S]*?)<\/title>/i)?.[1]?.trim() ?? null
  const desc = meta(html, "name", "description")
  const h1s = [...html.matchAll(/<h1[^>]*>([\s\S]*?)<\/h1>/gi)].map((m) => m[1].replace(/<[^>]+>/g, "").trim()).filter(Boolean)
  const city = opts.city?.trim().toLowerCase()
  return {
    business: opts.name,
    url: res.url,
    https: res.url.startsWith("https://"),
    status: res.status,
    responseTimeMs: ms,
    htmlSizeKB: Math.round(html.length / 1024),
    title: title && { text: title, length: title.length, mentionsCity: city ? title.toLowerCase().includes(city) : null },
    metaDescription: desc && { text: desc, length: desc.length },
    h1: h1s.slice(0, 3),
    canonical: html.match(/<link[^>]+rel=["']canonical["'][^>]*href=["']([^"']+)/i)?.[1] ?? null,
    mobileViewport: /<meta[^>]+name=["']viewport["']/i.test(html),
    noindex: /<meta[^>]+name=["']robots["'][^>]+noindex/i.test(html),
    openGraph: { title: !!meta(html, "property", "og:title"), image: !!meta(html, "property", "og:image") },
    structuredData: schemaTypes,
    hasRestaurantSchema: schemaTypes.some((t) => /Restaurant|LocalBusiness|FoodEstablishment|CafeOrCoffeeShop|Bakery|BarOrPub/.test(t)),
    sitemapXml: sitemap,
    robotsTxt: robots ? (/^\s*disallow:\s*\/\s*$/im.test(robots) ? "blocks everything" : "ok") : "not found",
    content: {
      words: text.split(/\s+/).filter(Boolean).length,
      menuOnPage: /\b(menu|men[uú]|carta)\b/i.test(text),
      phone: /(\+?\d[\d\s().-]{8,}\d)/.test(text),
      imagesWithoutAlt: (html.match(/<img\b(?![^>]*\balt=["'][^"']+["'])[^>]*>/gi) ?? []).length,
    },
    note: "This is a review of the homepage, not a full site audit or a real speed measurement.",
  }
}
