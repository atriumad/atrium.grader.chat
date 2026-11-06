// Booking settings. Read at call time so a changed .env.local is picked up in dev.
// Decisions (2026-11-05): 30 min meetings, Mon-Fri 09:00-17:00, America/New_York, 12 h notice.

export type BookingProviderKind = "none" | "mock" | "google"

export type BookingConfig = {
  provider: BookingProviderKind
  timezone: string
  durationMin: number
  startMinute: number // minutes from local midnight
  endMinute: number
  weekdays: number[] // 0 = Sunday ... 6 = Saturday
  minNoticeHours: number
  horizonDays: number
}

function hm(s: string, fallback: number): number {
  const m = s.match(/^(\d{1,2}):(\d{2})$/)
  return m ? Number(m[1]) * 60 + Number(m[2]) : fallback
}

export function bookingConfig(): BookingConfig {
  const raw = process.env.BOOKING_PROVIDER
  const provider: BookingProviderKind = raw === "mock" || raw === "google" ? raw : "none"
  const [from, to] = (process.env.BOOKING_HOURS ?? "09:00-17:00").split("-")
  const weekdays = (process.env.BOOKING_DAYS ?? "1,2,3,4,5")
    .split(",")
    .map((d) => Number(d.trim()))
    .filter((d) => Number.isInteger(d) && d >= 0 && d <= 6)
  return {
    provider,
    timezone: process.env.BOOKING_TIMEZONE ?? "America/New_York",
    durationMin: Math.max(10, Number(process.env.BOOKING_DURATION_MIN ?? 30)),
    startMinute: hm(from ?? "", 9 * 60),
    endMinute: hm(to ?? "", 17 * 60),
    weekdays: weekdays.length ? weekdays : [1, 2, 3, 4, 5],
    minNoticeHours: Number(process.env.BOOKING_MIN_NOTICE_HOURS ?? 12),
    horizonDays: Math.min(30, Number(process.env.BOOKING_HORIZON_DAYS ?? 14)),
  }
}
