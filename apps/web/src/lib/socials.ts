// The lookups live in @atrium/sources. This registers the web app's logger (Supabase lookup_logs) with it.
import { setLogger } from "@atrium/sources/log"
import { setSharedCache } from "@atrium/sources/cache"
import { logEvent, logLookup } from "@/lib/admin/log"
import { db, supabaseConfigured } from "@/lib/supabase/server"

setLogger({ logLookup, logEvent })

// Paid social lookups are shared across clients through the social_cache table. If the table is missing
// or Supabase is down, every call fails quietly and the lookup just runs (see supabase/migrations/0003).
if (supabaseConfigured()) {
  setSharedCache({
    async get(key) {
      const { data } = await db().from("social_cache").select("value").eq("key", key).gt("expires_at", new Date().toISOString()).maybeSingle()
      return data ? (data.value as { v: unknown }).v : undefined
    },
    async set(key, value, ttlSeconds) {
      await db().from("social_cache").upsert({ key, value: { v: value ?? null }, expires_at: new Date(Date.now() + ttlSeconds * 1000).toISOString() })
    },
  })
}

export * from "@atrium/sources/socials"
