"use client"

import * as React from "react"
import { IconArrowDownRight, IconArrowUpRight } from "@tabler/icons-react"

import type { Dataset } from "@/lib/analysis"
import { CompetitorMap, type MapPoint } from "@/components/results/competitor-map"
import { Button } from "@/components/ui/button"
import { gapsOf, type Gap } from "@/lib/gaps"
import {
  COMPETITOR_RADIUS_M,
  CONFIDENCE_LABEL,
  PART_LABEL,
  SCORE_CONFIG,
  TIER_LABEL,
  TIER_VAR,
  benchmarks,
  fmt,
  rivalsAverage,
  tierOf,
  toRows,
  type Benchmark,
  type Row,
  type Tier,
} from "@/lib/metrics"

// A bar that grows from zero once mounted: the one authored motion of the report.
// `mark` draws a thin tick (the competitors' average) on the same track.
function Meter({
  value,
  mark,
  color = "var(--foreground)",
  delay = 0,
  className = "",
}: {
  value: number | null
  mark?: number | null
  color?: string
  delay?: number
  className?: string
}) {
  const [on, setOn] = React.useState(false)
  React.useEffect(() => {
    const id = requestAnimationFrame(() => setOn(true))
    return () => cancelAnimationFrame(id)
  }, [])
  const pct = value === null ? 0 : Math.max(2, Math.min(100, value))
  return (
    <div className={`relative h-1.5 w-full rounded-full bg-muted ${className}`}>
      <div className="h-full overflow-hidden rounded-full">
        <div
          className="h-full w-full rounded-full"
          style={{
            background: color,
            transform: `scaleX(${on ? pct / 100 : 0})`,
            transformOrigin: "left",
            transition: `transform 900ms cubic-bezier(0.23, 1, 0.32, 1) ${delay}ms`,
          }}
        />
      </div>
      {mark != null ? (
        <span
          aria-hidden="true"
          title="Competitor average"
          className="absolute -top-1 h-3.5 w-0.5 -translate-x-1/2 rounded-full bg-brand"
          style={{ left: `${Math.max(0, Math.min(100, mark))}%` }}
        />
      ) : null}
    </div>
  )
}

function TierDot({ tier, className = "size-2.5" }: { tier: Tier; className?: string }) {
  return <span className={`inline-block shrink-0 rounded-full ${className}`} style={{ background: TIER_VAR[tier] }} aria-hidden="true" />
}

function ordinal(n: number): string {
  const s = ["th", "st", "nd", "rd"]
  const v = n % 100
  return `${n}${s[(v - 20) % 10] ?? s[v] ?? s[0]}`
}

function hasCoords(r: Row): r is Row & { lat: number; lng: number } {
  return r.lat !== null && r.lng !== null
}

function mapPoints(rows: Row[]): MapPoint[] {
  const pts: MapPoint[] = rows.filter(hasCoords).map((r) => ({
    key: r.key,
    rank: r.rank,
    isYou: r.isYou,
    name: r.name,
    lat: r.lat,
    lng: r.lng,
    score: r.score,
    tier: r.tier,
    rating: r.rating,
    reviews: r.reviews,
    followers: r.followers,
    engagement: r.engagement,
  }))
  // A map is only useful with the business and at least one competitor.
  return pts.some((p) => p.isYou) && pts.length > 1 ? pts : []
}

function mean(vals: Array<number | null>): number | null {
  const v = vals.filter((x): x is number => x !== null)
  return v.length ? v.reduce((a, b) => a + b, 0) / v.length : null
}

// The score as a ring that draws from zero once mounted, in the tier colour.
function ScoreRing({ score, tier }: { score: number | null; tier: Tier }) {
  const [on, setOn] = React.useState(false)
  React.useEffect(() => {
    const id = requestAnimationFrame(() => setOn(true))
    return () => cancelAnimationFrame(id)
  }, [])
  const r = 52
  const circumference = 2 * Math.PI * r
  const pct = score === null ? 0 : Math.max(0, Math.min(100, score)) / 100
  return (
    <div className="relative size-28 shrink-0">
      <svg viewBox="0 0 120 120" className="size-full -rotate-90" aria-hidden="true">
        <circle cx="60" cy="60" r={r} fill="none" strokeWidth="10" className="stroke-primary-foreground/15" />
        <circle
          cx="60"
          cy="60"
          r={r}
          fill="none"
          strokeWidth="10"
          strokeLinecap="round"
          stroke={TIER_VAR[tier]}
          strokeDasharray={circumference}
          strokeDashoffset={on ? circumference * (1 - pct) : circumference}
          style={{ transition: "stroke-dashoffset 1100ms cubic-bezier(0.23, 1, 0.32, 1)" }}
        />
      </svg>
      <div className="absolute inset-0 grid place-content-center text-center">
        <span className="font-display text-4xl leading-none tnum">{score ?? "—"}</span>
        {score !== null ? <span className="mt-1 text-xs text-muted-foreground">of 100</span> : null}
      </div>
    </div>
  )
}

function Hero({ you, total, avg, topGap }: { you: Row; total: number; avg: number | null; topGap: Gap | undefined }) {
  const diff = you.score !== null && avg !== null ? Math.round(you.score - avg) : null
  const verdict =
    diff === null
      ? "Not enough data yet to place you against your competitors."
      : diff < 0
        ? `You rank ${ordinal(you.rank)} of ${total} in your area: ${Math.abs(diff)} points below your competitors.`
        : diff > 0
          ? `You rank ${ordinal(you.rank)} of ${total} in your area: ${diff} points above your competitors.`
          : `You rank ${ordinal(you.rank)} of ${total} in your area, level with your competitors.`
  return (
    <div className="reveal-rise flex flex-wrap items-center gap-x-7 gap-y-5 rounded-2xl bg-foreground p-5 text-primary-foreground">
      <ScoreRing score={you.score} tier={you.tier} />
      <div className="flex min-w-0 flex-1 basis-56 flex-col gap-3">
        <p className="flex flex-wrap items-center gap-2 text-sm text-primary-foreground/70">
          Atrium Score
          <span className="inline-flex items-center gap-1.5 rounded-full border border-primary-foreground/25 px-2.5 py-0.5 text-xs font-medium text-primary-foreground">
            <TierDot tier={you.tier} className="size-2" />
            {TIER_LABEL[you.tier]}
          </span>
        </p>
        <h3 className="font-display text-xl leading-tight text-balance sm:text-2xl">{verdict}</h3>
        {topGap ? (
          <p className="text-sm text-primary-foreground/80">
            What holds you back most: <strong className="font-medium text-primary-foreground">{topGap.label}</strong> (−{topGap.behind} pts).
          </p>
        ) : null}
        <p className="text-xs text-primary-foreground/60 text-pretty">
          Confidence: {CONFIDENCE_LABEL[you.confidence.level]}
          {you.confidence.level !== "high" && you.missing.length > 0
            ? ` · provisional: missing data for ${you.missing.map((k) => PART_LABEL[k].toLowerCase()).join(", ")}`
            : ""}
        </p>
      </div>
    </div>
  )
}

// The one accent moment of the page: what to do next. Sober: a plain card where only the
// button carries the accent colour.
function NextStep({ gaps, ahead, onAsk }: { gaps: Gap[]; ahead: boolean; onAsk: (q: string) => void }) {
  const top = gaps[0]
  return (
    <aside aria-label="Next step" className="reveal-rise flex flex-col gap-5 rounded-2xl border bg-card p-5 sm:flex-row sm:items-center sm:justify-between sm:px-6" style={{ "--d": "180ms" } as React.CSSProperties}>
      <div className="flex min-w-0 flex-col gap-1">
        <p className="text-sm text-muted-foreground">Next step</p>
        <h3 className="font-display text-xl leading-snug text-balance sm:text-2xl">
          {top ? `Start with ${top.label.toLowerCase()}: it is where you lose the most ground.` : ahead ? "You are ahead. Keep the pace." : "Book a review of your analysis."}
        </h3>
        <p className="text-sm text-muted-foreground text-pretty">
          Book a meeting and we will build the plan to move you up together.
          {gaps.length > 1 ? ` ${gaps.slice(1, 3).map((g) => g.label).join(" and ")} also weigh on your score.` : ""}
        </p>
      </div>
      <div className="flex shrink-0 flex-wrap items-center gap-x-5 gap-y-2">
        <Button size="lg" className="bg-brand text-primary-foreground hover:bg-brand/90" onClick={() => onAsk("I want to book a meeting")}>
          Book a meeting
        </Button>
        <button type="button" className="text-sm text-muted-foreground underline-offset-4 transition-colors hover:text-foreground hover:underline" onClick={() => onAsk("What should I do first?")}>
          What should I do first?
        </button>
      </div>
    </aside>
  )
}

type Stat = { label: string; value: string | null; unit?: string; avg: string | null; better: boolean | null }

// One headline number with how it compares to the competitors' average. The comparison is
// always written ("Above / Below competitors"), never carried by colour alone.
function StatTile({ stat, index }: { stat: Stat; index: number }) {
  return (
    <div className="reveal-rise flex flex-col justify-between gap-3 rounded-2xl border bg-card p-4" style={{ "--d": `${(index + 1) * 70}ms` } as React.CSSProperties}>
      <p className="text-sm text-muted-foreground">{stat.label}</p>
      <p className={`font-display text-3xl leading-none tnum ${stat.value === null ? "text-muted-foreground" : ""}`}>
        {stat.value ?? "no data"}
        {stat.value !== null && stat.unit ? <span className="ms-1 font-sans text-base text-muted-foreground">{stat.unit}</span> : null}
      </p>
      <p className="flex items-center gap-1.5 text-xs text-muted-foreground tnum">
        {stat.avg === null ? (
          "No comparison"
        ) : stat.better === null ? (
          `Competitors ${stat.avg}`
        ) : stat.better ? (
          <>
            <IconArrowUpRight className="size-3.5 shrink-0 text-positive" aria-hidden="true" />
            Above competitors ({stat.avg})
          </>
        ) : (
          <>
            <IconArrowDownRight className="size-3.5 shrink-0 text-brand" aria-hidden="true" />
            Below competitors ({stat.avg})
          </>
        )}
      </p>
    </div>
  )
}

function statsOf(rows: Row[]): Stat[] {
  const you = rows.find((r) => r.isYou)!
  const rivals = rows.filter((r) => !r.isYou)
  const cmp = (a: number | null, b: number | null) => (a !== null && b !== null ? a >= b : null)
  const rating = mean(rivals.map((r) => r.rating))
  const reviews = mean(rivals.map((r) => r.reviews))
  const followers = mean(rivals.map((r) => r.followers))
  const engagement = mean(rivals.map((r) => r.engagement))
  return [
    {
      label: "Google rating",
      value: you.rating !== null ? fmt.rating(you.rating) : null,
      unit: "of 5",
      avg: rating !== null ? fmt.rating(rating) : null,
      better: cmp(you.rating, rating),
    },
    {
      label: "Google reviews",
      value: you.reviews !== null ? you.reviews.toLocaleString("en-US") : null,
      avg: reviews !== null ? Math.round(reviews).toLocaleString("en-US") : null,
      better: cmp(you.reviews, reviews),
    },
    {
      label: "Social followers",
      value: you.followers !== null ? fmt.followers(you.followers) : null,
      avg: followers !== null ? fmt.followers(followers) : null,
      better: cmp(you.followers, followers),
    },
    {
      label: "Engagement per follower",
      value: you.engagement !== null ? fmt.engagement(you.engagement) : null,
      avg: engagement !== null ? fmt.engagement(engagement) : null,
      better: cmp(you.engagement, engagement),
    },
  ]
}

function Signals({ bench }: { bench: Benchmark[] }) {
  return (
    <section aria-labelledby="signals-title" className="reveal-rise flex h-full flex-col overflow-hidden rounded-2xl border bg-card" style={{ "--d": "120ms" } as React.CSSProperties}>
      <h3 id="signals-title" className="border-b px-5 py-2.5 text-sm font-medium">
        Signals vs. competitors
      </h3>
      <ul className="flex flex-1 flex-col divide-y">
        {bench.map((b, i) => (
          <li key={b.key} className="flex flex-1 flex-col justify-center gap-1.5 px-5 py-3">
            <div className="flex items-baseline justify-between gap-3">
              <span className="flex flex-wrap items-baseline gap-x-2.5">
                <span className="font-medium">{b.label}</span>
                {b.you !== null && b.avg !== null ? (
                  <span className={`text-xs tnum ${Math.round(b.you - b.avg) < 0 ? "text-brand" : "text-positive"}`}>
                    {Math.round(b.you - b.avg) === 0 ? "level" : `${b.you > b.avg ? "+" : "−"}${Math.abs(Math.round(b.you - b.avg))} vs competitors`}
                  </span>
                ) : null}
              </span>
              <span className="font-display text-2xl leading-none tnum">{b.you === null ? "—" : Math.round(b.you)}</span>
            </div>
            <Meter value={b.you} mark={b.avg} color={TIER_VAR[tierOf(b.you)]} delay={i * 80} />
            <p className="text-xs text-muted-foreground tnum">
              {b.rawLabel}: <span className="text-foreground">{b.rawYou}</span>
              {b.rawAvg ? ` · competitors ${b.rawAvg}` : ""}
            </p>
          </li>
        ))}
        <li className="flex items-center gap-2 px-5 py-2.5 text-xs text-muted-foreground">
          <span className="h-3 w-0.5 rounded-full bg-brand" aria-hidden="true" /> The marker shows the competitor average
        </li>
      </ul>

      <details className="mt-auto border-t">
        <summary className="cursor-pointer px-5 py-3 text-sm text-muted-foreground transition-colors hover:text-foreground">
          How the score is calculated
        </summary>
        <div className="flex max-w-[68ch] flex-col gap-2 px-5 pb-4 text-sm text-muted-foreground text-pretty">
          <p>
            A score from 0 to 100 built from five signals: engagement {SCORE_CONFIG.weights.engagement}%, reputation {SCORE_CONFIG.weights.reputation}%,
            activity {SCORE_CONFIG.weights.activity}%, audience {SCORE_CONFIG.weights.audience}% and presence {SCORE_CONFIG.weights.presence}%. Social signals
            (Instagram, Facebook, TikTok and YouTube, whichever the business has) make up {100 - SCORE_CONFIG.weights.reputation}% and Google {SCORE_CONFIG.weights.reputation}%. If a signal is missing, the score is calculated from the others (at least two are needed) and the confidence level says so.
          </p>
          <p>
            <strong className="font-medium text-foreground">Engagement</strong> is compared with what is expected for the account size
            (4% under 5K followers, 3% up to 20K, 2% up to 100K and 1.2% above): matching it gives about 67 points and beating it by 1.5x gives
            100. When views are available they count for {SCORE_CONFIG.engagement.viewsShare * 100}%.{" "}
            <strong className="font-medium text-foreground">Reputation</strong> uses a Bayesian average of the rating (a 5.0 with few reviews
            is not worth the same as one with thousands) and the review volume.{" "}
            <strong className="font-medium text-foreground">Activity</strong> blends posting frequency (up to {SCORE_CONFIG.activity.postsPerWeekFull} posts
            per week, 60%) with how recent the last post is (40%).{" "}
            <strong className="font-medium text-foreground">Audience</strong> runs from {SCORE_CONFIG.audience.followersFloor.toLocaleString("en-US")} to{" "}
            {SCORE_CONFIG.audience.followersFull.toLocaleString("en-US")} followers on a logarithmic scale.
          </p>
          <p>
            Green from {SCORE_CONFIG.tiers.good}, orange from {SCORE_CONFIG.tiers.medium}, red below that. These are Atrium&apos;s own
            criteria, not an industry standard.
          </p>
        </div>
      </details>
    </section>
  )
}

// `children` is the written analysis: it sits right after the score, before the evidence.
export function Report({
  data,
  children,
  evidence = true,
  onAsk,
}: {
  data: Dataset
  children?: React.ReactNode
  // Next-step actions (book a meeting, ask the assistant). Hidden when there is no assistant.
  onAsk?: (question: string) => void
  // Map and ranking appear (with a reveal) only once the written analysis is done.
  evidence?: boolean
}) {
  const rows = React.useMemo(() => toRows(data), [data])
  const bench = React.useMemo(() => benchmarks(rows), [rows])
  const you = rows.find((r) => r.isYou)!
  const avg = React.useMemo(() => rivalsAverage(rows), [rows])
  const gaps = React.useMemo(() => gapsOf(bench), [bench])
  const stats = React.useMemo(() => statsOf(rows), [rows])
  const points = React.useMemo(() => mapPoints(rows), [rows])
  const showMap = points.length > 0
  const [active, setActive] = React.useState<string | null>(null)

  const ahead = you.score !== null && avg !== null && you.score >= avg

  return (
    <section aria-label="Analysis dashboard" className="report-rise flex flex-col gap-5">
      <header className="flex flex-wrap items-baseline justify-between gap-x-6 gap-y-1">
        <h2 className="font-display text-3xl leading-tight text-balance sm:text-4xl">{you.name}</h2>
        <p className="max-w-[65ch] text-sm text-muted-foreground text-pretty">{data.identification}</p>
      </header>

      {/* Verdict: the score and the four numbers that explain it */}
      <div className="grid gap-3 lg:grid-cols-[minmax(0,5fr)_minmax(0,7fr)]">
        <Hero you={you} total={rows.length} avg={avg} topGap={gaps[0]} />
        <div className="grid grid-cols-2 gap-3 xl:grid-cols-4">
          {stats.map((s, i) => (
            <StatTile key={s.label} stat={s} index={i} />
          ))}
        </div>
      </div>

      {/* Evidence: competitors and map on the left, signals on the right (same height) */}
      <div className={`grid items-stretch gap-5 ${evidence ? "lg:grid-cols-2" : ""}`}>
        {evidence ? (
          <div className="flex min-w-0 flex-col gap-3">
            <div className="reveal-rise overflow-hidden rounded-2xl border bg-card" style={{ "--d": "0ms" } as React.CSSProperties}>
              <h3 className="border-b px-4 py-2.5 text-sm font-medium">Competitors in your area</h3>
              <table className="w-full border-collapse text-sm">
                <tbody>
                  {rows.map((r, i) => (
                    <tr
                      key={r.key}
                      style={{ "--i": i } as React.CSSProperties}
                      onMouseEnter={() => setActive(r.key)}
                      onMouseLeave={() => setActive(null)}
                      className={`row-in border-t first:border-t-0 align-middle transition-colors ${active === r.key ? "bg-secondary" : r.isYou ? "bg-secondary/60" : ""}`}
                    >
                      <td className="w-12 py-2.5 pl-4">
                        <span className={`grid size-6 place-items-center rounded-full text-xs font-semibold tnum ${r.isYou ? "bg-foreground text-primary-foreground" : "bg-brand text-primary-foreground"}`}>
                          {r.rank}
                        </span>
                      </td>
                      <th scope="row" className="px-2 py-2.5 text-left font-normal">
                        <span className="flex flex-wrap items-center gap-x-2">
                          <span className="font-medium">{r.name}</span>
                          {r.isYou ? <span className="rounded-full bg-foreground px-2 py-0.5 text-[0.6875rem] text-primary-foreground">You</span> : null}
                        </span>
                      </th>
                      <td className="w-40 px-3 py-2.5 pr-4">
                        {r.score === null ? (
                          <span className="text-muted-foreground">—</span>
                        ) : (
                          <div className="flex items-center gap-2">
                            <span className="w-6 shrink-0 font-medium tnum">{r.score}</span>
                            <Meter value={r.score} color={TIER_VAR[r.tier]} delay={160 + i * 50} />
                          </div>
                        )}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
              <p className="border-t px-4 py-2 text-xs text-muted-foreground">Competitors: {data.competitorsSource}</p>
            </div>
            {showMap ? (
              <div className="reveal-clip flex min-h-64 flex-1 flex-col overflow-hidden rounded-2xl border bg-card">
                <div className="reveal-settle min-h-0 flex-1">
                  <CompetitorMap points={points} radiusMeters={COMPETITOR_RADIUS_M} activeKey={active} onActive={setActive} />
                </div>
                <p className="border-t px-4 py-2 text-xs text-muted-foreground">Halo = score · size = social audience.</p>
              </div>
            ) : null}
          </div>
        ) : null}
        <Signals bench={bench} />
      </div>

      {children ? (
        <section aria-label="Summary" className="reveal-rise flex min-w-0 flex-col gap-3 rounded-2xl border bg-card p-5" style={{ "--d": "120ms" } as React.CSSProperties}>
          {children}
        </section>
      ) : null}

      {onAsk ? <NextStep gaps={gaps} ahead={ahead} onAsk={onAsk} /> : null}
    </section>
  )
}
