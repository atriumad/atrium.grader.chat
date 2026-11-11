import { googleProvider, mockProvider, type BookingRequest, type CalendarProvider, type CreatedBooking } from "./calendar"
import { bookingConfig, type BookingConfig } from "./config"
import { buildSlots, pickSpread, type Slot } from "./slots"
import { formatSlot } from "./tz"

export type { Slot } from "./slots"
export { bookingConfig } from "./config"

export class BookingError extends Error {
  constructor(
    message: string,
    public code: "not_configured" | "invalid" | "unavailable" | "provider_error"
  ) {
    super(message)
  }
}

export function getProvider(cfg: BookingConfig = bookingConfig()): CalendarProvider | null {
  if (cfg.provider === "mock") return mockProvider
  if (cfg.provider === "google") return googleProvider
  return null
}

async function freshSlots(cfg: BookingConfig, provider: CalendarProvider): Promise<Slot[]> {
  const now = new Date()
  const to = new Date(now.getTime() + (cfg.horizonDays + 2) * 86_400_000)
  try {
    return buildSlots(cfg, now, await provider.busy(now, to))
  } catch (e) {
    throw new BookingError(e instanceof Error ? e.message : "I could not check the calendar.", "provider_error")
  }
}

export async function availableSlots(opts: { partOfDay?: "morning" | "afternoon" | "any"; daysAhead?: number } = {}): Promise<Slot[]> {
  const cfg = bookingConfig()
  const provider = getProvider(cfg)
  if (!provider) throw new BookingError("The calendar is not configured.", "not_configured")
  const all = await freshSlots(cfg, provider)
  const cutoff = opts.daysAhead ? Date.now() + opts.daysAhead * 86_400_000 : Infinity
  return pickSpread(cfg, all.filter((s) => new Date(s.start).getTime() <= cutoff), { partOfDay: opts.partOfDay })
}

// The slot with this exact start, if it is still bookable right now.
export async function findFreeSlot(start: string): Promise<Slot | null> {
  const cfg = bookingConfig()
  const provider = getProvider(cfg)
  if (!provider) throw new BookingError("The calendar is not configured.", "not_configured")
  const iso = Number.isNaN(Date.parse(start)) ? null : new Date(start).toISOString()
  if (!iso) return null
  return (await freshSlots(cfg, provider)).find((s) => s.start === iso) ?? null
}

const clean = (s: unknown, max: number) =>
  typeof s === "string" ? s.replace(/[\u0000-\u001f\u007f]/g, " ").replace(/\s+/g, " ").trim().slice(0, max) : ""

export type BookingInput = {
  start: string
  name: string
  email: string
  phone?: string
  notes?: string
  businessName: string
  score?: number | null
}

// Validates everything the client sent and checks the slot is still free right now.
export function validateInput(input: BookingInput): { ok: true; value: Required<Omit<BookingInput, "score">> & { score: number | null } } | { ok: false; error: string } {
  const name = clean(input.name, 80)
  const email = clean(input.email, 120)
  const phone = clean(input.phone, 25)
  const notes = clean(input.notes, 500)
  const businessName = clean(input.businessName, 120)
  if (name.length < 2) return { ok: false, error: "Enter your name." }
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/.test(email)) return { ok: false, error: "The email address does not look valid." }
  if (phone && !/^[+()\d\s.-]{6,25}$/.test(phone)) return { ok: false, error: "The phone number does not look valid." }
  if (!businessName) return { ok: false, error: "The business name is missing." }
  if (Number.isNaN(Date.parse(input.start))) return { ok: false, error: "The time slot is not valid." }
  const score = typeof input.score === "number" && Number.isFinite(input.score) ? Math.round(input.score) : null
  return { ok: true, value: { start: new Date(input.start).toISOString(), name, email, phone, notes, businessName, score } }
}

let lock: Promise<unknown> = Promise.resolve()

export async function createBooking(input: BookingInput): Promise<CreatedBooking & { label: string }> {
  const cfg = bookingConfig()
  const provider = getProvider(cfg)
  if (!provider) throw new BookingError("The calendar is not configured.", "not_configured")
  const v = validateInput(input)
  if (!v.ok) throw new BookingError(v.error, "invalid")

  // One booking at a time, so two people cannot take the same slot in this process.
  const run = async () => {
    const slots = await freshSlots(cfg, provider)
    const slot = slots.find((s) => s.start === v.value.start)
    if (!slot) throw new BookingError("That time slot is no longer available.", "unavailable")
    const req: BookingRequest = { ...v.value, end: slot.end }
    try {
      const created = await provider.create(req, cfg)
      return { ...created, label: formatSlot(new Date(slot.start), cfg.timezone) }
    } catch (e) {
      throw new BookingError(e instanceof Error ? e.message : "I could not create the meeting.", "provider_error")
    }
  }
  const result = lock.then(run, run)
  lock = result.catch(() => undefined)
  return result
}
