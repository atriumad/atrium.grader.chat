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

export type LookupLog = {
  kind: "scrape" | "links" | "network"
  target?: string | null
  request?: Record<string, unknown>
  ok: boolean
  status?: number | null
  durationMs?: number
  summary?: unknown
  response?: string | null
  error?: string | null
}

const RESPONSE_MAX = 8_000

// What each external lookup returned, for the admin "Búsquedas" page. Fire-and-forget.
export function logLookup(l: LookupLog): void {
  if (!supabaseConfigured()) return
  void Promise.resolve(
    db().from("lookup_logs").insert({
      kind: l.kind,
      target: l.target?.slice(0, 300) ?? null,
      request: l.request ?? {},
      ok: l.ok,
      status: l.status ?? null,
      duration_ms: l.durationMs ?? null,
      summary: l.summary ?? null,
      response: l.response ? l.response.slice(0, RESPONSE_MAX) : null,
      error: l.error?.slice(0, 500) ?? null,
    })
  ).catch(() => {})
}
