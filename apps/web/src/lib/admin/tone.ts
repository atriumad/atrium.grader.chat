export type Tone = "cercano" | "formal" | "directo"

export const TONE_LABEL: Record<Tone, string> = { cercano: "Cercano", formal: "Formal", directo: "Directo y breve" }

export function toneLine(t: Tone): string {
  if (t === "formal") return "profesional y formal; trata de usted al usuario, sin coloquialismos."
  if (t === "directo") return "directo y muy conciso; ve al grano, sin introducciones ni frases de cortesía largas."
  return "cercano y profesional, claro y sin jerga."
}
