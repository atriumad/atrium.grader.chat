import type { Benchmark, PartKey } from "@/lib/metrics"

export type Gap = {
  key: PartKey
  label: string
  // What the business has vs the competitors' average, straight from the benchmarks.
  you: string
  rivals: string
  // Points behind the competitors' average on the 0-100 part score.
  behind: number
  // Part scores (0-100) for the business and the competitors' average, to draw both.
  youScore: number
  avgScore: number
  action: string
}

// Fixed, reproducible advice per signal: the numbers come from the data, never from the model.
const ACTION: Record<PartKey, string> = {
  engagement: "Post content that invites replies: questions, daily specials, behind the scenes, and answer the comments.",
  reputation: "Ask every happy customer for a Google review (QR code on the table or the receipt) and reply to existing ones.",
  activity: "Post more often: aim for 3 posts per week on the network where you already have the most audience.",
  audience: "Grow your audience with local collaborations and by tagging your location in every post.",
  presence: "Activate one more network with a post in the last 30 days; presence only counts with recent activity.",
}

// The signals where the business trails the competitors, biggest weighted gap first.
export function gapsOf(bench: Benchmark[], limit = 3): Gap[] {
  return bench
    .flatMap((b) => {
      if (b.you === null || b.avg === null || b.you >= b.avg) return []
      const behind = b.avg - b.you
      return [{ priority: behind * b.weight, gap: { key: b.key, label: b.label, you: b.rawYou, rivals: b.rawAvg ?? "—", behind: Math.round(behind), youScore: b.you, avgScore: b.avg, action: ACTION[b.key] } }]
    })
    .sort((a, b) => b.priority - a.priority)
    .slice(0, limit)
    .map((x) => x.gap)
}
