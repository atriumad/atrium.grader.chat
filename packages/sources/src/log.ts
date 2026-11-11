// Lookups are logged through whatever the host app registers (the web app writes to Supabase).
// Without one, logging does nothing, so this package has no database dependency.

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

export type Logger = {
  logLookup(l: LookupLog): void
  logEvent(kind: string, meta?: Record<string, unknown>): void
}

let current: Logger = { logLookup() {}, logEvent() {} }

export const setLogger = (logger: Logger): void => {
  current = logger
}
export const logLookup = (l: LookupLog): void => current.logLookup(l)
export const logEvent = (kind: string, meta?: Record<string, unknown>): void => current.logEvent(kind, meta)
