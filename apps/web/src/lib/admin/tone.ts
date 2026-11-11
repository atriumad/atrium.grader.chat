export type Tone = "cercano" | "formal" | "directo"

export const TONE_LABEL: Record<Tone, string> = { cercano: "Friendly", formal: "Formal", directo: "Direct and brief" }

export function toneLine(t: Tone): string {
  if (t === "formal") return "professional and formal; no colloquialisms."
  if (t === "directo") return "direct and very concise; get to the point, no introductions or long courtesy phrases."
  return "friendly and professional, clear and jargon-free."
}
