// Outbound fetch for URLs that came from outside the system (a business website, an Instagram
// profile link, a client-supplied dataset). It refuses anything that would reach internal
// infrastructure: private and loopback addresses, cloud metadata, odd ports and non-http schemes.
// Hostnames are resolved first and every address must be public; redirects are followed by hand
// so each hop is checked as well.
import { lookup } from "node:dns/promises"
import { isIP } from "node:net"

export function hostOf(u: string): string | null {
  try {
    return new URL(/^https?:\/\//i.test(u) ? u : `https://${u}`).hostname.replace(/^www\./, "").toLowerCase()
  } catch {
    return null
  }
}

// Loopback, private ranges, link-local (cloud metadata) and reserved addresses, IPv4 and IPv6.
export function isPrivateAddress(address: string): boolean {
  const a = address.replace(/^\[|\]$/g, "").toLowerCase()
  const mapped = a.match(/^::ffff:(\d+\.\d+\.\d+\.\d+)$/)
  if (mapped) return isPrivateAddress(mapped[1])
  if (a.includes(":")) return a === "::" || a === "::1" || a.startsWith("fc") || a.startsWith("fd") || a.startsWith("fe8") || a.startsWith("fe9") || a.startsWith("fea") || a.startsWith("feb") || a.startsWith("ff") || a.startsWith("::ffff:")
  const m = a.match(/^(\d+)\.(\d+)\.(\d+)\.(\d+)$/)
  if (!m) return false
  const [x, y] = [Number(m[1]), Number(m[2])]
  return x === 0 || x === 10 || x === 127 || (x === 169 && y === 254) || (x === 172 && y >= 16 && y <= 31) || (x === 192 && y === 168) || (x === 100 && y >= 64 && y <= 127) || x >= 224
}

// Hostnames that are internal by name, before any DNS lookup.
export function isPrivateHost(host: string): boolean {
  const h = host.replace(/^\[|\]$/g, "").toLowerCase()
  if (h === "localhost" || h.endsWith(".localhost") || h.endsWith(".local") || h.endsWith(".internal")) return true
  return isIP(h) ? isPrivateAddress(h) : false
}

// Replaceable so tests can run without a network.
export const resolver: { lookup: (host: string, opts: { all: true }) => Promise<Array<{ address: string; family: number }>> } = {
  lookup: (host, opts) => lookup(host, opts),
}

export class UnsafeUrlError extends Error {}

async function assertPublic(url: URL): Promise<void> {
  if (url.protocol !== "http:" && url.protocol !== "https:") throw new UnsafeUrlError("only http(s) URLs are allowed")
  if (url.username || url.password) throw new UnsafeUrlError("URLs with credentials are not allowed")
  if (url.port && url.port !== "80" && url.port !== "443") throw new UnsafeUrlError("unusual ports are not allowed")
  const host = url.hostname
  if (isPrivateHost(host)) throw new UnsafeUrlError("internal host")
  if (isIP(host.replace(/^\[|\]$/g, ""))) return
  const addresses = await resolver.lookup(host, { all: true })
  if (!addresses.length || addresses.some((a) => isPrivateAddress(a.address))) throw new UnsafeUrlError("host resolves to an internal address")
}

const MAX_REDIRECTS = 4

export async function safeFetch(input: string | URL, init: RequestInit = {}): Promise<Response> {
  let url = new URL(input)
  for (let hop = 0; hop <= MAX_REDIRECTS; hop++) {
    await assertPublic(url)
    const res = await fetch(url, { ...init, redirect: "manual" })
    const location = res.headers.get("location")
    if (res.status >= 300 && res.status < 400 && location) {
      await res.body?.cancel().catch(() => {})
      url = new URL(location, url)
      continue
    }
    // `url` of a manual-redirect response is the request URL: expose the final one like fetch does.
    if (hop > 0 || !res.url) Object.defineProperty(res, "url", { value: url.href })
    return res
  }
  throw new UnsafeUrlError("too many redirects")
}
