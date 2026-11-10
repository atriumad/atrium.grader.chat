import type { Benchmark, PartKey } from "@/lib/metrics"

export type Gap = {
  key: PartKey
  label: string
  // What the business has vs the competitors' average, straight from the benchmarks.
  you: string
  rivals: string
  // Points behind the competitors' average on the 0-100 part score.
  behind: number
  action: string
}

// Fixed, reproducible advice per signal: the numbers come from the data, never from the model.
const ACTION: Record<PartKey, string> = {
  engagement: "Publica contenido que invite a responder: preguntas, platos del día, detrás de cámaras, y contesta los comentarios.",
  reputation: "Pide reseñas en Google a cada cliente satisfecho (QR en la mesa o en el ticket) y responde las existentes.",
  activity: "Sube la frecuencia: apunta a 3 posts por semana en la red donde ya tienes más audiencia.",
  audience: "Crece la audiencia con colaboraciones locales y etiquetando tu ubicación en cada post.",
  presence: "Activa una red más con un post en los últimos 30 días; la presencia cuenta solo si hay actividad reciente.",
}

// The signals where the business trails the competitors, biggest weighted gap first.
export function gapsOf(bench: Benchmark[], limit = 3): Gap[] {
  return bench
    .flatMap((b) => {
      if (b.you === null || b.avg === null || b.you >= b.avg) return []
      const behind = b.avg - b.you
      return [{ priority: behind * b.weight, gap: { key: b.key, label: b.label, you: b.rawYou, rivals: b.rawAvg ?? "—", behind: Math.round(behind), action: ACTION[b.key] } }]
    })
    .sort((a, b) => b.priority - a.priority)
    .slice(0, limit)
    .map((x) => x.gap)
}
