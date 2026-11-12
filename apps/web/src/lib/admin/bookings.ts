import { getProvider } from "@/lib/booking"
import { db } from "@/lib/supabase/server"

export type BookingStatus = "scheduled" | "completed" | "cancelled"

export type BookingRecord = {
  id: string
  created_at: string
  start_at: string
  end_at: string
  provider: "google" | "mock"
  calendar_event_id: string | null
  meet_link: string | null
  name: string
  email: string
  phone: string | null
  business_name: string
  score: number | null
  notes: string | null
  email_visitor: boolean | null
  email_ops: boolean | null
  email_error: string | null
  status: BookingStatus
  internal_notes: string | null
  updated_at: string | null
  updated_by: string | null
}

export const STATUS_LABEL: Record<BookingStatus, string> = {
  scheduled: "Scheduled",
  completed: "Completed",
  cancelled: "Cancelled",
}

const NOTES_MAX = 2000

export type BookingPatch = { status?: BookingStatus; internalNotes?: string }

export function parsePatch(body: unknown): BookingPatch | null {
  const b = (body && typeof body === "object" ? body : null) as Record<string, unknown> | null
  if (!b) return null
  const patch: BookingPatch = {}
  if (b.status !== undefined) {
    if (b.status !== "scheduled" && b.status !== "completed" && b.status !== "cancelled") return null
    patch.status = b.status
  }
  if (b.internalNotes !== undefined) {
    if (typeof b.internalNotes !== "string") return null
    patch.internalNotes = b.internalNotes.replace(/\u0000/g, "").trim().slice(0, NOTES_MAX)
  }
  return patch.status || patch.internalNotes !== undefined ? patch : null
}

// Status rules: cancelled is final (the calendar event is gone), the rest can move around.
// Cancelling deletes the calendar event first, so a failure leaves everything as it was.
export async function updateBooking(id: string, patch: BookingPatch, by: string): Promise<{ ok: true } | { ok: false; error: string; status: number }> {
  const { data: cur, error } = await db().from("bookings").select("status, provider, calendar_event_id").eq("id", id).maybeSingle()
  if (error) return { ok: false, error: "Could not read the meeting.", status: 500 }
  if (!cur) return { ok: false, error: "Meeting not found.", status: 404 }
  if (cur.status === "cancelled" && patch.status && patch.status !== "cancelled") {
    return { ok: false, error: "A cancelled meeting cannot be reopened: its calendar event was deleted.", status: 409 }
  }
  if (patch.status === "cancelled" && cur.status !== "cancelled" && cur.calendar_event_id) {
    const provider = getProvider()
    // The record's provider decides, not the current env: a mock booking has nothing in Google.
    if (cur.provider === "google") {
      if (!provider || provider.kind !== "google") return { ok: false, error: "Google Calendar is not configured, so the event could not be deleted.", status: 503 }
      try {
        await provider.cancel(cur.calendar_event_id as string)
      } catch (e) {
        return { ok: false, error: e instanceof Error ? e.message : "Could not delete the calendar event.", status: 502 }
      }
    }
  }
  const update: Record<string, unknown> = { updated_at: new Date().toISOString(), updated_by: by }
  if (patch.status) update.status = patch.status
  if (patch.internalNotes !== undefined) update.internal_notes = patch.internalNotes || null
  const { error: upErr } = await db().from("bookings").update(update).eq("id", id)
  return upErr ? { ok: false, error: "Could not save.", status: 500 } : { ok: true }
}
