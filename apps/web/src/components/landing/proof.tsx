import { cacheLife } from "next/cache"

import { db, supabaseConfigured } from "@/lib/supabase/server"

// How many different businesses have been analysed. Only shown once it is a number worth showing
// (below MIN it would read as a small, unproven tool), and never made up: it is counted from the
// analyses table, hourly cached.
const MIN = 25

async function analysedBusinesses(): Promise<number | null> {
  "use cache"
  cacheLife("hours")
  if (!supabaseConfigured()) return null
  const { data, error } = await db().from("analyses").select("business_name").limit(5000)
  if (error || !data) return null
  return new Set(data.map((r) => String(r.business_name).trim().toLowerCase()).filter(Boolean)).size
}

export async function Proof() {
  const n = await analysedBusinesses().catch(() => null)
  if (!n || n < MIN) return null
  return <li>{new Intl.NumberFormat("en-US").format(n)} businesses analysed</li>
}
