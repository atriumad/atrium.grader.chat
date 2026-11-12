import { AsyncLocalStorage } from "node:async_hooks"
import { randomUUID } from "node:crypto"

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

// Which analysis a lookup belongs to. The analyze route sets it once; every external lookup made
// during that request is then tagged (in `request._ctx`) so the admin can group them by client.
export type LookupContext = { run: string; query: string; business?: string }
const lookupStore = new AsyncLocalStorage<LookupContext>()

export function startLookupContext(query: string): LookupContext {
  const ctx: LookupContext = { run: randomUUID(), query: query.slice(0, 200) }
  lookupStore.enterWith(ctx)
  return ctx
}

// What each external lookup returned, for the admin "Lookups" page. Fire-and-forget.
export function logLookup(l: LookupLog): void {
  if (!supabaseConfigured()) return
  const ctx = lookupStore.getStore()
  void Promise.resolve(
    db().from("lookup_logs").insert({
      kind: l.kind,
      target: l.target?.slice(0, 300) ?? null,
      request: ctx ? { ...(l.request ?? {}), _ctx: { run: ctx.run, query: ctx.query, business: ctx.business ?? null } } : (l.request ?? {}),
      ok: l.ok,
      status: l.status ?? null,
      duration_ms: l.durationMs ?? null,
      summary: l.summary ?? null,
      response: l.response ? l.response.slice(0, RESPONSE_MAX) : null,
      error: l.error?.slice(0, 500) ?? null,
    })
  ).catch(() => {})
}

export type BookingRow = {
  start: string
  end: string
  provider: "google" | "mock"
  eventId: string | null
  meetLink: string | null
  name: string
  email: string
  phone: string
  businessName: string
  score: number | null
  notes: string
  emails?: { visitor: boolean; ops: boolean; error?: string }
}

// Awaited (serverless would cut a floating promise) but never throws: the meeting already exists.
export async function saveBooking(b: BookingRow): Promise<void> {
  if (!supabaseConfigured()) return
  try {
    await db().from("bookings").insert({
      start_at: b.start,
      end_at: b.end,
      provider: b.provider,
      calendar_event_id: b.eventId,
      meet_link: b.meetLink,
      name: b.name,
      email: b.email,
      phone: b.phone || null,
      business_name: b.businessName,
      score: b.score,
      notes: b.notes || null,
      email_visitor: b.emails?.visitor ?? null,
      email_ops: b.emails?.ops ?? null,
      email_error: b.emails?.error?.slice(0, 500) ?? null,
    })
  } catch {
    // Logging must never break a booking.
  }
}
