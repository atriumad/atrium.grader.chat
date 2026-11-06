import type { Dataset, Entity } from "./types"

// Must match the default radius used by findCompetitors in places.ts.
export const COMPETITOR_RADIUS_M = 3000

// ---------------------------------------------------------------------------
// Puntaje Atrium: 0-100 per business, built only from data we actually have.
// Rules approved by the agency on 2026-11-05. The numbers are our own judgment,
// not an industry standard: tune them here. The UI, the map and the AI prompt
// all read this one place. A copy lives in the mobile app (src/lib/metrics.ts).
// ---------------------------------------------------------------------------
export const SCORE_CONFIG = {
  // Social signals weigh 70% because they are the agency's focus; Google reputation 30%.
  weights: { engagement: 30, reputation: 30, activity: 25, audience: 15 },
  tiers: { good: 70, medium: 45 },
  reputation: {
    priorMean: 4.2, // rating we assume for a restaurant with no reviews
    priorWeight: 50, // how many reviews that assumption is worth (Bayesian average)
    ratingFloor: 3.5, // adjusted rating at or below this scores 0 (5.0 scores 100)
    ratingShare: 0.8, // share of the part that comes from the rating
    volumeFull: 2000, // reviews that give the full volume score (log scale)
  },
  engagement: {
    // Expected engagement rate by account size: big accounts always get less.
    expectedByFollowers: [
      { upTo: 5_000, expected: 4 },
      { upTo: 20_000, expected: 3 },
      { upTo: 100_000, expected: 2 },
      { upTo: Infinity, expected: 1.2 },
    ],
    fullRatio: 1.5, // 1.5x the expected rate scores 100 (1.0x scores about 67)
    viewsShare: 0.3, // share of the part that comes from views / followers, when known
    viewsFull: 0.5, // average views equal to 50% of followers score 100
  },
  activity: {
    postsPerWeekFull: 4,
    frequencyShare: 0.6, // frequency 60%, recency 40%
    // Days since the last post -> score. Anything older than the last step scores 0.
    recency: [
      { days: 3, score: 100 },
      { days: 7, score: 80 },
      { days: 14, score: 50 },
      { days: 30, score: 20 },
    ],
  },
  audience: { followersFloor: 1_000, followersFull: 100_000 },
  confidence: {
    minPostsSample: 8, // fewer posts than this and the Instagram numbers are shaky
    high: 0.85,
    medium: 0.6,
  },
} as const

export type Tier = "good" | "medium" | "low" | "none"
export type PartKey = keyof typeof SCORE_CONFIG.weights
export type ConfidenceLevel = "high" | "medium" | "low"

export const TIER_LABEL: Record<Tier, string> = {
  good: "Bueno",
  medium: "Medio",
  low: "Bajo",
  none: "Sin datos",
}
export const CONFIDENCE_LABEL: Record<ConfidenceLevel, string> = {
  high: "alta",
  medium: "media",
  low: "baja",
}
export const PART_LABEL: Record<PartKey, string> = {
  engagement: "Engagement",
  reputation: "Reputación",
  activity: "Actividad",
  audience: "Audiencia",
}
export const TIER_VAR: Record<Tier, string> = {
  good: "var(--tier-good)",
  medium: "var(--tier-medium)",
  low: "var(--tier-low)",
  none: "var(--tier-none)",
}

export type ScorePart = { key: PartKey; score: number | null }
export type Score = {
  total: number | null
  tier: Tier
  parts: ScorePart[]
  // How complete the data behind the score is (0-1) and a plain level for the UI.
  confidence: { value: number; level: ConfidenceLevel }
  missing: PartKey[]
}

const clamp01 = (n: number) => Math.max(0, Math.min(1, n))

export function tierOf(total: number | null): Tier {
  if (total === null) return "none"
  if (total >= SCORE_CONFIG.tiers.good) return "good"
  if (total >= SCORE_CONFIG.tiers.medium) return "medium"
  return "low"
}

// Rating pulled toward the prior by the number of reviews: 5.0 with 3 reviews is not 5.0.
export function bayesianRating(rating: number, reviews: number | null): number {
  const { priorMean, priorWeight } = SCORE_CONFIG.reputation
  if (reviews === null || reviews < 0) return rating
  return (reviews * rating + priorWeight * priorMean) / (reviews + priorWeight)
}

export function expectedEngagement(followers: number | null): number {
  const tiers = SCORE_CONFIG.engagement.expectedByFollowers
  const f = followers ?? 20_000
  return tiers.find((t) => f <= t.upTo)!.expected
}

function recencyScore(days: number): number {
  for (const step of SCORE_CONFIG.activity.recency) if (days <= step.days) return step.score
  return 0
}

function reputationPart(e: Entity): number | null {
  const rating = e.place?.rating ?? null
  if (rating === null) return null
  const c = SCORE_CONFIG.reputation
  const reviews = e.place?.reviews ?? null
  const ratingScore = clamp01((bayesianRating(rating, reviews) - c.ratingFloor) / (5 - c.ratingFloor))
  const volumeScore = reviews !== null ? clamp01(Math.log10(reviews + 1) / Math.log10(c.volumeFull + 1)) : 0
  return 100 * (c.ratingShare * ratingScore + (1 - c.ratingShare) * volumeScore)
}

function engagementPart(e: Entity): number | null {
  const ig = e.instagram
  if (!ig || ig.engagementRatePct == null) return null
  const c = SCORE_CONFIG.engagement
  const ratio = ig.engagementRatePct / expectedEngagement(ig.followers)
  const base = 100 * clamp01(ratio / c.fullRatio)
  if (ig.avgViews != null && ig.avgViews > 0 && ig.followers) {
    const views = 100 * clamp01(ig.avgViews / ig.followers / c.viewsFull)
    return (1 - c.viewsShare) * base + c.viewsShare * views
  }
  return base
}

function activityPart(e: Entity): number | null {
  const ig = e.instagram
  if (!ig) return null
  const c = SCORE_CONFIG.activity
  const freq = ig.postsPerWeek != null ? 100 * clamp01(ig.postsPerWeek / c.postsPerWeekFull) : null
  const rec = ig.lastPostDaysAgo != null ? recencyScore(ig.lastPostDaysAgo) : null
  if (freq !== null && rec !== null) return c.frequencyShare * freq + (1 - c.frequencyShare) * rec
  return freq ?? rec
}

function audiencePart(e: Entity): number | null {
  const f = e.instagram?.followers
  if (f == null || f <= 0) return null
  const a = SCORE_CONFIG.audience
  return 100 * clamp01((Math.log10(f) - Math.log10(a.followersFloor)) / (Math.log10(a.followersFull) - Math.log10(a.followersFloor)))
}

function partsFor(e: Entity): ScorePart[] {
  return [
    { key: "engagement", score: engagementPart(e) },
    { key: "reputation", score: reputationPart(e) },
    { key: "activity", score: activityPart(e) },
    { key: "audience", score: audiencePart(e) },
  ]
}

// Weighted average over the parts we have; needs at least two to mean anything.
function totalOf(parts: ScorePart[]): number | null {
  const have = parts.filter((p): p is { key: PartKey; score: number } => p.score !== null)
  if (have.length < 2) return null
  const w = SCORE_CONFIG.weights
  const sum = have.reduce((a, p) => a + w[p.key] * p.score, 0)
  const weight = have.reduce((a, p) => a + w[p.key], 0)
  return Math.round(sum / weight)
}

// Confidence = share of the weight that has data, reduced when the Instagram sample is small.
function confidenceOf(e: Entity, parts: ScorePart[]): Score["confidence"] {
  const w = SCORE_CONFIG.weights
  const total = Object.values(w).reduce((a, b) => a + b, 0)
  const have = parts.filter((p) => p.score !== null).reduce((a, p) => a + w[p.key], 0)
  const c = SCORE_CONFIG.confidence
  const sampleFactor = e.instagram && e.instagram.postsSampled < c.minPostsSample ? 0.7 : 1
  const value = (have / total) * sampleFactor
  return { value, level: value >= c.high ? "high" : value >= c.medium ? "medium" : "low" }
}

export function scoreEntity(e: Entity): Score {
  const parts = partsFor(e)
  const total = totalOf(parts)
  return {
    total,
    tier: tierOf(total),
    parts,
    confidence: confidenceOf(e, parts),
    missing: parts.filter((p) => p.score === null).map((p) => p.key),
  }
}

// Index 0 is the business, then the competitors, in dataset order.
export function scoreAll(d: Dataset): Score[] {
  return [d.business, ...d.competitors].map(scoreEntity)
}

// ---------------------------------------------------------------------------

export type Row = {
  key: string
  name: string
  handle: string | null
  isYou: boolean
  rank: number // 1 = best score
  score: number | null
  tier: Tier
  parts: ScorePart[]
  confidence: Score["confidence"]
  missing: PartKey[]
  followers: number | null
  engagement: number | null
  postsPerWeek: number | null
  lastPostDaysAgo: number | null
  rating: number | null
  reviews: number | null
  lat: number | null
  lng: number | null
  note: string | null
}

function toRow(e: Entity, s: Score, isYou: boolean, i: number): Omit<Row, "rank"> {
  const hasCoords = !!e.place && (e.place.lat !== 0 || e.place.lng !== 0)
  return {
    key: `${isYou ? "you" : "c"}-${i}`,
    name: e.name,
    handle: e.instagram?.handle ?? null,
    isYou,
    score: s.total,
    tier: s.tier,
    parts: s.parts,
    confidence: s.confidence,
    missing: s.missing,
    followers: e.instagram?.followers ?? null,
    engagement: e.instagram?.engagementRatePct ?? null,
    postsPerWeek: e.instagram?.postsPerWeek ?? null,
    lastPostDaysAgo: e.instagram?.lastPostDaysAgo ?? null,
    rating: e.place?.rating ?? null,
    reviews: e.place?.reviews ?? null,
    lat: hasCoords ? e.place!.lat : null,
    lng: hasCoords ? e.place!.lng : null,
    note: e.instagramNote && e.instagramNote !== "ok" ? e.instagramNote : null,
  }
}

// Rows sorted by score (best first, no-data last), each with its rank.
export function toRows(d: Dataset): Row[] {
  const scores = scoreAll(d)
  const base = [toRow(d.business, scores[0], true, 0), ...d.competitors.map((c, i) => toRow(c, scores[i + 1], false, i))]
  const sorted = [...base].sort((a, b) => (b.score ?? -1) - (a.score ?? -1))
  return sorted.map((r, i) => ({ ...r, rank: i + 1 }))
}

// ---------------------------------------------------------------------------

const compact = new Intl.NumberFormat("es", { notation: "compact", maximumFractionDigits: 1 })

export const fmt = {
  followers: (n: number) => compact.format(n),
  engagement: (n: number) => `${n.toFixed(2)}%`,
  postsPerWeek: (n: number) => n.toFixed(1),
  rating: (n: number) => n.toFixed(1),
}

export type Benchmark = {
  key: PartKey
  label: string
  weight: number
  you: number | null // part score 0-100
  avg: number | null // average part score of the competitors
  rawLabel: string // what the part measures
  rawYou: string
  rawAvg: string | null
  better: boolean | null
}

const PARTS: Array<{
  key: PartKey
  rawLabel: string
  raw: (r: Row) => number | null
  format: (n: number) => string
  // Replaces the plain value for the business, to add context (expected rate, last post).
  you?: (r: Row) => string | null
}> = [
  {
    key: "engagement",
    rawLabel: "Interacción por seguidor",
    raw: (r) => r.engagement,
    format: fmt.engagement,
    you: (r) =>
      r.engagement === null ? null : `${fmt.engagement(r.engagement)} (esperable ${expectedEngagement(r.followers)}% para tu tamaño)`,
  },
  { key: "reputation", rawLabel: "Rating en Google", raw: (r) => r.rating, format: fmt.rating },
  {
    key: "activity",
    rawLabel: "Posts por semana",
    raw: (r) => r.postsPerWeek,
    format: fmt.postsPerWeek,
    you: (r) =>
      r.postsPerWeek === null
        ? null
        : `${fmt.postsPerWeek(r.postsPerWeek)}${r.lastPostDaysAgo !== null ? ` · último post hace ${r.lastPostDaysAgo} d` : ""}`,
  },
  { key: "audience", rawLabel: "Seguidores en Instagram", raw: (r) => r.followers, format: fmt.followers },
]

function mean(vals: Array<number | null>): number | null {
  const v = vals.filter((x): x is number => x !== null)
  return v.length ? v.reduce((a, b) => a + b, 0) / v.length : null
}

export function benchmarks(rows: Row[]): Benchmark[] {
  const you = rows.find((r) => r.isYou)!
  const rivals = rows.filter((r) => !r.isYou)
  return PARTS.map((p) => {
    const youScore = you.parts.find((x) => x.key === p.key)?.score ?? null
    const avgScore = mean(rivals.map((r) => r.parts.find((x) => x.key === p.key)?.score ?? null))
    const youRaw = p.raw(you)
    const avgRaw = mean(rivals.map(p.raw))
    return {
      key: p.key,
      label: PART_LABEL[p.key],
      weight: SCORE_CONFIG.weights[p.key],
      you: youScore,
      avg: avgScore,
      rawLabel: p.rawLabel,
      rawYou: youRaw === null ? "—" : (p.you?.(you) ?? p.format(youRaw)),
      rawAvg: avgRaw === null ? null : p.format(avgRaw),
      better: youScore !== null && avgScore !== null ? youScore >= avgScore : null,
    }
  })
}

// Mean score of the competitors, to compare against yours.
export function rivalsAverage(rows: Row[]): number | null {
  const m = mean(rows.filter((r) => !r.isYou).map((r) => r.score))
  return m === null ? null : Math.round(m)
}
