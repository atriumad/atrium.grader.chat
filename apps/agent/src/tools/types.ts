import type { ErrorClass } from "../types.ts"

export type ToolResult = {
  status: "ok" | "empty" | "error"
  errorClass?: ErrorClass
  data: unknown
  source: string // neutral label ("public listing"), never a vendor name
  fetchedAt: string
  costCents?: number
}

export type ToolContext = {
  signal: AbortSignal
  clientId?: string
  // Hosts that belong to the subject (from its listing). Tools that fetch arbitrary URLs stay inside this set.
  subjectHosts?: string[]
}

export type ToolDef = {
  name: string
  run(input: Record<string, unknown>, ctx: ToolContext): Promise<ToolResult>
  // Short text for the progress event, built from the result (never from the model).
  summarize?(result: ToolResult): string | undefined
}

export type Registry = Map<string, ToolDef>

export const createRegistry = (defs: ToolDef[]): Registry => new Map(defs.map((d) => [d.name, d]))

export const failure = (errorClass: ErrorClass, source = "agent"): ToolResult => ({
  status: "error",
  errorClass,
  data: null,
  source,
  fetchedAt: new Date().toISOString(),
})
