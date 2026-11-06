import type { BookingConfig } from "./config"
import { formatSlot, localParts, zonedToUtc } from "./tz"

export type Interval = { start: Date; end: Date }
export type Slot = { start: string; end: string; label: string } // ISO UTC + label in the agency's zone

const MIN = 60_000

// Every bookable start time in the horizon: working days and hours, after the notice
// period, and not overlapping anything already busy.
export function buildSlots(cfg: BookingConfig, now: Date, busy: Interval[]): Slot[] {
  const out: Slot[] = []
  const earliest = now.getTime() + cfg.minNoticeHours * 60 * MIN
  const today = localParts(now, cfg.timezone)
  for (let i = 0; i <= cfg.horizonDays; i++) {
    // Walk calendar days in the agency's zone (Date.UTC avoids host-timezone drift).
    const day = new Date(Date.UTC(today.y, today.m - 1, today.d + i))
    if (!cfg.weekdays.includes(day.getUTCDay())) continue
    for (let t = cfg.startMinute; t + cfg.durationMin <= cfg.endMinute; t += cfg.durationMin) {
      const start = zonedToUtc(day.getUTCFullYear(), day.getUTCMonth() + 1, day.getUTCDate(), Math.floor(t / 60), t % 60, cfg.timezone)
      if (start.getTime() < earliest) continue
      const end = new Date(start.getTime() + cfg.durationMin * MIN)
      if (busy.some((b) => start < b.end && end > b.start)) continue
      out.push({ start: start.toISOString(), end: end.toISOString(), label: formatSlot(start, cfg.timezone) })
    }
  }
  return out
}

// A short, varied list to show: a few days, a couple of times per day, spread across the day.
export function pickSpread(
  cfg: BookingConfig,
  slots: Slot[],
  opts: { partOfDay?: "morning" | "afternoon" | "any"; maxDays?: number; perDay?: number; limit?: number } = {}
): Slot[] {
  const { partOfDay = "any", maxDays = 4, perDay = 2, limit = 8 } = opts
  const byDay = new Map<string, Slot[]>()
  for (const s of slots) {
    const p = localParts(new Date(s.start), cfg.timezone)
    if (partOfDay === "morning" && p.h >= 12) continue
    if (partOfDay === "afternoon" && p.h < 12) continue
    const key = `${p.y}-${p.m}-${p.d}`
    byDay.set(key, [...(byDay.get(key) ?? []), s])
  }
  const picked: Slot[] = []
  for (const list of [...byDay.values()].slice(0, maxDays)) {
    if (list.length <= perDay) picked.push(...list)
    else for (let k = 0; k < perDay; k++) picked.push(list[Math.round((k * (list.length - 1)) / (perDay - 1))])
  }
  return picked.slice(0, limit)
}
