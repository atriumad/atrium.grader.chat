import type { Dataset } from "@/lib/analysis"
import { db, supabaseConfigured } from "@/lib/supabase/server"

// Fire-and-forget: logging must never slow down or break the public app.
export function logEvent(kind: string, meta: Record<string, unknown> = {}): void {
  if (!supabaseConfigured()) return
  void Promise.resolve(db().from("events").insert({ kind, meta })).catch(() => {})
}

export function saveAnalysis(row: {
  query: string
  data: Dataset
  score: number | null
  source: string
  durationMs: number
}): void {
  if (!supabaseConfigured()) return
  void Promise.resolve(
    db().from("analyses").insert({
      query: row.query.slice(0, 200),
      business_name: row.data.business.name.slice(0, 200),
      score: row.score,
      competitors: row.data.competitors.length,
      source: row.source,
      duration_ms: row.durationMs,
      dataset: row.data,
    })
  ).catch(() => {})
}
