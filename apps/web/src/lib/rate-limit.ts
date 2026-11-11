// Tiny in-memory limiter per client. It protects the API spend; it resets when the server restarts.
const hits = new Map<string, number[]>()

export function allow(key: string, max: number, windowMs: number): boolean {
  const now = Date.now()
  const recent = (hits.get(key) ?? []).filter((t) => now - t < windowMs)
  if (recent.length >= max) {
    hits.set(key, recent)
    return false
  }
  recent.push(now)
  hits.set(key, recent)
  return true
}

// The platform-set headers come first: x-forwarded-for can carry a value the client made up.
export function clientKey(req: Request): string {
  const h = req.headers
  return (h.get("x-vercel-forwarded-for") ?? h.get("x-real-ip") ?? h.get("x-forwarded-for")?.split(",")[0] ?? "local").trim().slice(0, 64) || "local"
}
