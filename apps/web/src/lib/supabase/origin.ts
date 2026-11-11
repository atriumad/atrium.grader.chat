// Public origin of this request. `new URL(req.url).origin` is the bind address in dev
// (http://0.0.0.0:3000) and the internal host behind proxies, so read the headers instead.
export function originOf(req: Request): string {
  // A configured site URL wins: the Host header is client-controlled, and this origin ends up in magic links.
  const configured = process.env.SITE_URL?.trim().replace(/\/$/, "")
  if (configured && /^https?:\/\//.test(configured)) return configured
  const host = req.headers.get("x-forwarded-host") ?? req.headers.get("host")
  if (!host) return new URL(req.url).origin
  const proto = req.headers.get("x-forwarded-proto")?.split(",")[0] ?? (/^(localhost|127\.0\.0\.1)(:|$)/.test(host) ? "http" : "https")
  return `${proto}://${host}`
}
