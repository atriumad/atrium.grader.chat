import { promises as fs } from "node:fs"
import path from "node:path"
import { randomUUID } from "node:crypto"

import type { BookingConfig } from "./config"
import type { Interval } from "./slots"

export type BookingRequest = {
  start: string // ISO UTC
  end: string // ISO UTC
  name: string
  email: string
  phone?: string
  notes?: string
  businessName: string
  score?: number | null
}
export type CreatedBooking = { id: string; meetLink?: string; mock: boolean }

export interface CalendarProvider {
  kind: "mock" | "google"
  busy(from: Date, to: Date): Promise<Interval[]>
  create(req: BookingRequest, cfg: BookingConfig): Promise<CreatedBooking>
  /** Removes the event so the slot is free again. Already gone counts as done. */
  cancel(eventId: string): Promise<void>
}

// ---------------------------------------------------------------------------
// Mock: a JSON file on disk. Only used when BOOKING_PROVIDER=mock is set on purpose.
// It never contacts anyone: nothing real is booked.
// ---------------------------------------------------------------------------
const MOCK_FILE = path.join(process.cwd(), ".data", "mock-bookings.json")
type MockRow = BookingRequest & { id: string; createdAt: string }

async function readMock(): Promise<MockRow[]> {
  try {
    return JSON.parse(await fs.readFile(MOCK_FILE, "utf8")) as MockRow[]
  } catch {
    return []
  }
}

export const mockProvider: CalendarProvider = {
  kind: "mock",
  async busy(from, to) {
    return (await readMock())
      .map((b) => ({ start: new Date(b.start), end: new Date(b.end) }))
      .filter((b) => b.start < to && b.end > from)
  },
  async create(req) {
    const rows = await readMock()
    const row: MockRow = { ...req, id: randomUUID(), createdAt: new Date().toISOString() }
    await fs.mkdir(path.dirname(MOCK_FILE), { recursive: true })
    await fs.writeFile(MOCK_FILE, JSON.stringify([...rows, row], null, 2))
    return { id: row.id, mock: true }
  },
  async cancel(eventId) {
    const rows = await readMock()
    await fs.writeFile(MOCK_FILE, JSON.stringify(rows.filter((r) => r.id !== eventId), null, 2))
  },
}

// ---------------------------------------------------------------------------
// Google Calendar over REST with an OAuth refresh token (the agency's own account).
// NOT YET TESTED against a real calendar: it needs credentials the agency has to create.
// Env: GOOGLE_CLIENT_ID, GOOGLE_CLIENT_SECRET, GOOGLE_REFRESH_TOKEN, GOOGLE_CALENDAR_ID (default "primary").
// ---------------------------------------------------------------------------
let cachedToken: { value: string; expires: number } | null = null

async function googleToken(): Promise<string> {
  const { GOOGLE_CLIENT_ID: id, GOOGLE_CLIENT_SECRET: secret, GOOGLE_REFRESH_TOKEN: refresh } = process.env
  if (!id || !secret || !refresh) throw new Error("Google Calendar is not configured on the server.")
  if (cachedToken && cachedToken.expires > Date.now() + 60_000) return cachedToken.value
  const res = await fetch("https://oauth2.googleapis.com/token", {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams({ client_id: id, client_secret: secret, refresh_token: refresh, grant_type: "refresh_token" }),
    signal: AbortSignal.timeout(15_000),
  })
  if (!res.ok) throw new Error(`Google OAuth ${res.status}: could not renew the calendar permission.`)
  const json = (await res.json()) as { access_token: string; expires_in: number }
  cachedToken = { value: json.access_token, expires: Date.now() + json.expires_in * 1000 }
  return cachedToken.value
}

const calendarId = () => process.env.GOOGLE_CALENDAR_ID ?? "primary"

export const googleProvider: CalendarProvider = {
  kind: "google",
  async busy(from, to) {
    const token = await googleToken()
    const res = await fetch("https://www.googleapis.com/calendar/v3/freeBusy", {
      method: "POST",
      headers: { Authorization: `Bearer ${token}`, "Content-Type": "application/json" },
      body: JSON.stringify({ timeMin: from.toISOString(), timeMax: to.toISOString(), items: [{ id: calendarId() }] }),
      signal: AbortSignal.timeout(15_000),
    })
    if (!res.ok) throw new Error(`Google Calendar ${res.status} while checking availability.`)
    const json = (await res.json()) as { calendars?: Record<string, { busy?: Array<{ start: string; end: string }> }> }
    const list = json.calendars?.[calendarId()]?.busy ?? Object.values(json.calendars ?? {})[0]?.busy ?? []
    return list.map((b) => ({ start: new Date(b.start), end: new Date(b.end) }))
  },
  async create(req, cfg) {
    const token = await googleToken()
    const description = [
      `Booked from Atrium Grader.`,
      `Business: ${req.businessName}`,
      req.score != null ? `Atrium Score: ${req.score}/100` : null,
      `Contact: ${req.name} · ${req.email}${req.phone ? ` · ${req.phone}` : ""}`,
      req.notes ? `Notes: ${req.notes}` : null,
    ]
      .filter(Boolean)
      .join("\n")
    const res = await fetch(
      `https://www.googleapis.com/calendar/v3/calendars/${encodeURIComponent(calendarId())}/events?conferenceDataVersion=1&sendUpdates=none`,
      {
        method: "POST",
        headers: { Authorization: `Bearer ${token}`, "Content-Type": "application/json" },
        body: JSON.stringify({
          summary: `Atrium consultation · ${req.businessName}`,
          description,
          start: { dateTime: req.start, timeZone: cfg.timezone },
          end: { dateTime: req.end, timeZone: cfg.timezone },
          attendees: [{ email: req.email, displayName: req.name }],
          conferenceData: { createRequest: { requestId: randomUUID(), conferenceSolutionKey: { type: "hangoutsMeet" } } },
          reminders: { useDefault: true },
        }),
        signal: AbortSignal.timeout(20_000),
      }
    )
    if (!res.ok) throw new Error(`Google Calendar ${res.status} while creating the event.`)
    const json = (await res.json()) as { id: string; hangoutLink?: string }
    return { id: json.id, meetLink: json.hangoutLink, mock: false }
  },
  async cancel(eventId) {
    const token = await googleToken()
    const res = await fetch(
      `https://www.googleapis.com/calendar/v3/calendars/${encodeURIComponent(calendarId())}/events/${encodeURIComponent(eventId)}?sendUpdates=none`,
      { method: "DELETE", headers: { Authorization: `Bearer ${token}` }, signal: AbortSignal.timeout(15_000) }
    )
    // 404 / 410: it was already deleted in Google Calendar, which is what we wanted.
    if (!res.ok && res.status !== 404 && res.status !== 410) throw new Error(`Google Calendar ${res.status} while cancelling the event.`)
  },
}
