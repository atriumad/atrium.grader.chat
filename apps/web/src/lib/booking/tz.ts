// Time zone helpers built on Intl, so there is no date library to depend on.

type Parts = { y: number; m: number; d: number; h: number; min: number; weekday: number }

export function localParts(date: Date, tz: string): Parts {
  const f = new Intl.DateTimeFormat("en-US", {
    timeZone: tz,
    hourCycle: "h23",
    year: "numeric",
    month: "numeric",
    day: "numeric",
    hour: "numeric",
    minute: "numeric",
  })
  const p: Record<string, number> = {}
  for (const part of f.formatToParts(date)) if (part.type !== "literal") p[part.type] = Number(part.value)
  const weekday = new Date(Date.UTC(p.year, p.month - 1, p.day)).getUTCDay()
  return { y: p.year, m: p.month, d: p.day, h: p.hour, min: p.minute, weekday }
}

function offsetMs(utcMs: number, tz: string): number {
  const p = localParts(new Date(utcMs), tz)
  const asUtc = Date.UTC(p.y, p.m - 1, p.d, p.h, p.min)
  return asUtc - Math.floor(utcMs / 60_000) * 60_000
}

// The UTC instant at which the wall clock in `tz` reads y-m-d h:min.
export function zonedToUtc(y: number, m: number, d: number, h: number, min: number, tz: string): Date {
  const guess = Date.UTC(y, m - 1, d, h, min)
  let ms = guess - offsetMs(guess, tz)
  ms = guess - offsetMs(ms, tz) // second pass handles daylight saving edges
  return new Date(ms)
}

export function formatSlot(date: Date, tz: string): string {
  const day = new Intl.DateTimeFormat("es-US", { timeZone: tz, weekday: "long", day: "numeric", month: "long" }).format(date)
  const time = new Intl.DateTimeFormat("es-US", { timeZone: tz, hour: "numeric", minute: "2-digit", hour12: true }).format(date)
  const abbr = new Intl.DateTimeFormat("en-US", { timeZone: tz, timeZoneName: "short" })
    .formatToParts(date)
    .find((p) => p.type === "timeZoneName")?.value
  return `${day}, ${time}${abbr ? ` (${abbr})` : ""}`
}
