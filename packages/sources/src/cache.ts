// Cache for paid lookups. Two layers: this process (always on) and, if the host app registers one,
// a shared store (the web app registers Supabase). Failures are never cached, so a provider outage
// or a missing balance cannot turn into "this business has no account" for the next days.
import { logEvent } from "./log.ts"

export type SharedCache = {
  get(key: string): Promise<unknown | undefined>
  set(key: string, value: unknown, ttlSeconds: number): Promise<void>
}

let shared: SharedCache | null = null
export const setSharedCache = (c: SharedCache | null): void => {
  shared = c
}

const memory = new Map<string, { value: unknown; expires: number }>()
const inflight = new Map<string, Promise<unknown>>()
const MAX_MEMORY = 2_000

const days = (n: number) => n * 86_400

// SOCIAL_CACHE_DAYS=0 turns the cache off (for debugging a provider).
export const socialTtl = (fallbackDays: number): number => {
  const n = Number(process.env.SOCIAL_CACHE_DAYS)
  return days(Number.isFinite(n) && process.env.SOCIAL_CACHE_DAYS !== undefined && process.env.SOCIAL_CACHE_DAYS !== "" ? n : fallbackDays)
}

export async function cached<T>(key: string, ttlSeconds: number, fn: () => Promise<T>): Promise<T> {
  if (ttlSeconds <= 0) return fn()
  const hit = memory.get(key)
  if (hit && hit.expires > Date.now()) return hit.value as T
  const pending = inflight.get(key)
  if (pending) return pending as Promise<T>

  const run = (async () => {
    try {
      const stored = await shared?.get(key).catch(() => undefined)
      if (stored !== undefined) {
        memory.set(key, { value: stored, expires: Date.now() + ttlSeconds * 1000 })
        logEvent("social_cache", { key, hit: "shared" })
        return stored as T
      }
    } catch {
      // A broken shared cache must not break the lookup.
    }
    const value = await fn() // throws propagate: nothing is stored
    if (memory.size >= MAX_MEMORY) memory.delete(memory.keys().next().value as string)
    memory.set(key, { value, expires: Date.now() + ttlSeconds * 1000 })
    void shared?.set(key, value, ttlSeconds).catch(() => {})
    return value
  })()
  inflight.set(key, run)
  try {
    return await run
  } finally {
    inflight.delete(key)
  }
}

export const clearMemoryCache = (): void => memory.clear()
