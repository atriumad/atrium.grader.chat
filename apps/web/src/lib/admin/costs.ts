// Real spend, read from the providers. Apify reports what each run cost; Google does not expose
// billing through the Places API, so its spend is an estimate from counted calls.

export type ApifyUsage = {
  cycleStart: string
  cycleEnd: string
  usedUsd: number
  limitUsd: number
  runs: number
  byActor: Array<{ actor: string; runs: number; usd: number }>
  last7dUsd: number
}

const API = "https://api.apify.com/v2"

async function get<T>(path: string, token: string): Promise<T> {
  const res = await fetch(`${API}${path}`, { headers: { Authorization: `Bearer ${token}` }, cache: "no-store", signal: AbortSignal.timeout(10_000) })
  if (!res.ok) throw new Error(`Apify ${res.status}`)
  return ((await res.json()) as { data: T }).data
}

export async function getApifyUsage(): Promise<ApifyUsage | null> {
  const token = process.env.APIFY_TOKEN
  if (!token) return null
  const [limits, list] = await Promise.all([
    get<{ monthlyUsageCycle: { startAt: string; endAt: string }; limits: { maxMonthlyUsageUsd: number }; current: { monthlyUsageUsd: number } }>("/users/me/limits", token),
    get<{ items: Array<{ actId: string; startedAt: string; usageTotalUsd?: number }> }>("/actor-runs?limit=1000&desc=1", token),
  ])
  const start = new Date(limits.monthlyUsageCycle.startAt).getTime()
  const week = Date.now() - 7 * 86_400_000
  const runs = list.items.filter((r) => new Date(r.startedAt).getTime() >= start)
  const byId = new Map<string, { runs: number; usd: number }>()
  let last7dUsd = 0
  for (const r of runs) {
    const cur = byId.get(r.actId) ?? { runs: 0, usd: 0 }
    cur.runs++
    cur.usd += r.usageTotalUsd ?? 0
    byId.set(r.actId, cur)
    if (new Date(r.startedAt).getTime() >= week) last7dUsd += r.usageTotalUsd ?? 0
  }
  // Actor ids are opaque: resolve them to names (a handful of distinct actors).
  const named = await Promise.all(
    [...byId.entries()].map(async ([id, v]) => {
      const a = await get<{ name: string; username: string }>(`/acts/${id}`, token).catch(() => null)
      return { actor: a ? `${a.username}/${a.name}` : id, ...v }
    })
  )
  return {
    cycleStart: limits.monthlyUsageCycle.startAt,
    cycleEnd: limits.monthlyUsageCycle.endAt,
    usedUsd: limits.current.monthlyUsageUsd,
    limitUsd: limits.limits.maxMonthlyUsageUsd,
    runs: runs.length,
    byActor: named.sort((a, b) => b.usd - a.usd),
    last7dUsd,
  }
}

// List prices in USD per 1,000 requests for the fields the app asks for (rating, website: the
// "Enterprise" tier). Google's free monthly allowance is not subtracted. Adjust if pricing changes.
export const GOOGLE_PRICE_PER_1000: Record<string, { label: string; usd: number }> = {
  autocomplete: { label: "Suggestions while typing", usd: 2.83 },
  text_search: { label: "Business search", usd: 35 },
  nearby: { label: "Nearby competitors", usd: 35 },
  details: { label: "Chosen listing", usd: 20 },
}
