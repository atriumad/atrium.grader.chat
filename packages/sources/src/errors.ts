// Tells a provider that failed apart from a business that simply is not there.
// "No Instagram found" and "the provider is out of credits" must never look the same.

export type FailureClass = "rate_limited" | "out_of_credits" | "timeout" | "not_found" | "unknown"

export function classifyError(e: unknown): FailureClass {
  const err = e as { status?: unknown; name?: unknown; message?: unknown } | null
  const status = typeof err?.status === "number" ? err.status : Number(String(err?.message ?? "").match(/\b(402|404|429)\b/)?.[1])
  if (status === 402) return "out_of_credits"
  if (status === 429) return "rate_limited"
  if (status === 404) return "not_found"
  if (err?.name === "TimeoutError" || err?.name === "AbortError") return "timeout"
  return "unknown"
}
