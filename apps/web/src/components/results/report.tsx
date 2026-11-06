"use client"

import * as React from "react"

import type { Dataset } from "@/lib/analysis"
import { CompetitorMap, type MapPoint } from "@/components/results/competitor-map"
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
          title="Promedio de la competencia"
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

function ScorePanel({ you, total, avg, bench }: { you: Row; total: number; avg: number | null; bench: Benchmark[] }) {
  const tierColor = TIER_VAR[you.tier]
  const diff = you.score !== null && avg !== null ? you.score - avg : null
  return (
    <div className="overflow-hidden rounded-2xl border bg-card">
      <div className="grid md:grid-cols-[16rem_1fr]">
        <div className="relative isolate flex flex-col justify-center gap-6 overflow-hidden border-b p-5 md:border-r md:border-b-0">
          <div
            aria-hidden="true"
            className="pointer-events-none absolute -top-16 -left-16 -z-10 size-72 rounded-full"
            style={{
              background: `radial-gradient(circle, color-mix(in oklab, ${tierColor} 38%, transparent) 0 30%, color-mix(in oklab, ${tierColor} 12%, transparent) 55%, transparent 70%)`,
            }}
          />
          <div className="flex flex-col gap-2">
            <p className="text-sm text-muted-foreground">Puntaje Atrium</p>
            <p className="flex items-baseline gap-1.5">
              <span className="font-display text-7xl leading-none tnum">{you.score ?? "—"}</span>
              {you.score !== null ? <span className="text-lg text-muted-foreground">/100</span> : null}
            </p>
            <p className="inline-flex w-fit items-center gap-2 rounded-full border bg-card/80 px-3 py-1 text-sm font-medium">
              <TierDot tier={you.tier} />
              {TIER_LABEL[you.tier]}
            </p>
            <p className="max-w-[18rem] text-xs text-muted-foreground text-pretty">
              Confianza {CONFIDENCE_LABEL[you.confidence.level]}
              {you.confidence.level !== "high" && you.missing.length > 0
                ? ` · provisional: faltan datos de ${you.missing.map((k) => PART_LABEL[k].toLowerCase()).join(", ")}`
                : ""}
            </p>
          </div>
          <p className="text-sm">
            <span className="font-medium">Puesto {you.rank} de {total}</span>
            {avg !== null ? (
              <span className="block text-muted-foreground tnum">
                Competencia: {avg}
                {diff !== null && Math.round(diff) !== 0 ? (
                  <span className={diff > 0 ? "text-positive" : "text-brand"}> ({diff > 0 ? "+" : "−"}{Math.abs(Math.round(diff))})</span>
                ) : null}
              </span>
            ) : null}
          </p>
        </div>

        <ul className="flex flex-col divide-y">
          {bench.map((b, i) => (
            <li key={b.key} className="flex flex-col gap-2 px-5 py-3.5">
              <div className="flex items-baseline justify-between gap-3">
                <span className="font-medium">{b.label}</span>
                <span className="font-display text-2xl leading-none tnum">{b.you === null ? "—" : Math.round(b.you)}</span>
              </div>
              <Meter value={b.you} mark={b.avg} delay={i * 80} />
              <p className="text-xs text-muted-foreground tnum">
                {b.rawLabel}: <span className="text-foreground">{b.rawYou}</span>
                {b.rawAvg ? ` · competencia ${b.rawAvg}` : ""}
              </p>
            </li>
          ))}
          <li className="flex items-center gap-2 px-5 py-2.5 text-xs text-muted-foreground">
            <span className="h-3 w-0.5 rounded-full bg-brand" aria-hidden="true" /> La marca indica el promedio de la competencia
          </li>
        </ul>
      </div>

      <details className="border-t">
        <summary className="cursor-pointer px-5 py-3 text-sm text-muted-foreground transition-colors hover:text-foreground">
          Cómo se calcula el puntaje
        </summary>
        <div className="flex max-w-[68ch] flex-col gap-2 px-5 pb-4 text-sm text-muted-foreground text-pretty">
          <p>
            Nota de 0 a 100 con cinco señales: engagement {SCORE_CONFIG.weights.engagement}%, reputación {SCORE_CONFIG.weights.reputation}%,
            actividad {SCORE_CONFIG.weights.activity}%, audiencia {SCORE_CONFIG.weights.audience}% y presencia {SCORE_CONFIG.weights.presence}%. Las señales
            sociales (Instagram, Facebook, TikTok y YouTube, las que tenga el negocio) suman un {100 - SCORE_CONFIG.weights.reputation}% y Google un {SCORE_CONFIG.weights.reputation}%. Si falta una señal se calcula con las demás (hacen falta al menos dos) y la confianza lo indica.
          </p>
          <p>
            <strong className="font-medium text-foreground">Engagement</strong> se compara con lo esperable para el tamaño de la cuenta
            (4% bajo 5 mil seguidores, 3% hasta 20 mil, 2% hasta 100 mil y 1.2% por encima): igualarlo da unos 67 puntos y superarlo 1.5 veces da
            100. Si hay vistas, cuentan un {SCORE_CONFIG.engagement.viewsShare * 100}%.{" "}
            <strong className="font-medium text-foreground">Reputación</strong> usa un promedio bayesiano del rating (un 5.0 con pocas reseñas
            no vale como uno con miles) y el volumen de reseñas.{" "}
            <strong className="font-medium text-foreground">Actividad</strong> mezcla la frecuencia (hasta {SCORE_CONFIG.activity.postsPerWeekFull} posts
            por semana, un 60%) con lo reciente que es el último post (40%).{" "}
            <strong className="font-medium text-foreground">Audiencia</strong> va de {SCORE_CONFIG.audience.followersFloor.toLocaleString("es")} a{" "}
            {SCORE_CONFIG.audience.followersFull.toLocaleString("es")} seguidores en escala logarítmica.
          </p>
          <p>
            Verde desde {SCORE_CONFIG.tiers.good}, naranja desde {SCORE_CONFIG.tiers.medium}, rojo por debajo. Son criterios propios de
            Atrium, no un estándar de la industria.
          </p>
        </div>
      </details>
    </div>
  )
}

// `children` is the written analysis: it sits right after the score, before the evidence.
export function Report({
  data,
  children,
  evidence = true,
}: {
  data: Dataset
  children?: React.ReactNode
  // Map and ranking appear (with a reveal) only once the written analysis is done.
  evidence?: boolean
}) {
  const rows = React.useMemo(() => toRows(data), [data])
  const bench = React.useMemo(() => benchmarks(rows), [rows])
  const you = rows.find((r) => r.isYou)!
  const avg = React.useMemo(() => rivalsAverage(rows), [rows])
  const points = React.useMemo(() => mapPoints(rows), [rows])
  const showMap = points.length > 0
  const [active, setActive] = React.useState<string | null>(null)

  return (
    <section aria-label="Resumen del análisis" className="report-rise flex flex-col gap-8">
      <div className="flex flex-col gap-5">
        <header className="flex flex-col gap-1">
          <h2 className="font-display text-3xl leading-tight text-balance sm:text-4xl">{you.name}</h2>
          <p className="max-w-[65ch] text-sm text-muted-foreground text-pretty">{data.identification}</p>
        </header>
        <ScorePanel you={you} total={rows.length} avg={avg} bench={bench} />
      </div>

      {children}

      {evidence && showMap ? (
        <div className="reveal-clip overflow-hidden rounded-2xl border bg-card">
          <h3 className="border-b px-4 py-3 text-sm font-medium sm:px-5">Dónde compites</h3>
          <div className="reveal-settle">
            <CompetitorMap points={points} radiusMeters={COMPETITOR_RADIUS_M} activeKey={active} onActive={setActive} />
          </div>
          <p className="border-t px-4 py-2.5 text-xs text-muted-foreground sm:px-5">
            Halo = puntaje · tamaño = audiencia total en redes. Pulsa un pin para el detalle.
          </p>
        </div>
      ) : null}

      {evidence ? (
      <div className="reveal-rise overflow-hidden rounded-2xl border bg-card" style={{ "--d": showMap ? "260ms" : "0ms" } as React.CSSProperties}>
        <h3 className="border-b px-4 py-3 text-sm font-medium sm:px-5">Ranking de tu zona</h3>
        <div className="overflow-x-auto">
          <table className="w-full sm:min-w-[560px] border-collapse text-sm">
            <thead>
              <tr className="text-left text-xs text-muted-foreground">
                <th scope="col" className="w-12 py-2.5 pl-4 font-normal sm:pl-5">#</th>
                <th scope="col" className="px-3 py-2.5 font-normal">Negocio</th>
                <th scope="col" className="w-24 px-2 py-2.5 pr-4 font-normal sm:w-40 sm:px-3">Puntaje</th>
                <th scope="col" className="hidden px-3 py-2.5 text-right font-normal sm:table-cell">Seguidores</th>
                <th scope="col" className="hidden px-4 py-2.5 text-right font-normal sm:table-cell sm:px-5">Engagement</th>
              </tr>
            </thead>
            <tbody>
              {rows.map((r, i) => (
                <tr
                  key={r.key}
                  style={{ "--i": i } as React.CSSProperties}
                  onMouseEnter={() => setActive(r.key)}
                  onMouseLeave={() => setActive(null)}
                  className={`row-in border-t align-middle transition-colors ${active === r.key ? "bg-secondary" : r.isYou ? "bg-secondary/60" : ""}`}
                >
                  <td className="w-10 py-3 pl-4 sm:w-12 sm:pl-5">
                    <span
                      className={`grid size-6 place-items-center rounded-full text-xs font-semibold tnum ${
                        r.isYou ? "bg-foreground text-primary-foreground" : "bg-brand text-primary-foreground"
                      }`}
                    >
                      {r.rank}
                    </span>
                  </td>
                  <th scope="row" className="px-2 py-3 text-left font-normal sm:px-3">
                    <span className="flex flex-wrap items-center gap-x-2 gap-y-1">
                      <span className="font-medium">{r.name}</span>
                      {r.isYou ? (
                        <span className="rounded-full bg-foreground px-2 py-0.5 text-[0.6875rem] text-primary-foreground">Tú</span>
                      ) : null}
                    </span>
                    {r.handle ? <span className="block text-xs text-muted-foreground">@{r.handle}</span> : null}
                    {r.note ? <span className="block max-w-[30ch] text-xs text-muted-foreground">{r.note}</span> : null}
                    <span className="mt-0.5 block text-xs text-muted-foreground tnum sm:hidden">
                      {r.followers === null ? "—" : `${fmt.followers(r.followers)} seg.`} · {r.engagement === null ? "—" : fmt.engagement(r.engagement)}
                    </span>
                  </th>
                  <td className="px-2 py-3 pr-4 sm:px-3 sm:pr-3">
                    {r.score === null ? (
                      <span className="text-muted-foreground">—</span>
                    ) : (
                      <div className="flex flex-col gap-1.5 sm:flex-row sm:items-center sm:gap-2.5">
                        <span className="w-7 shrink-0 font-medium tnum">{r.score}</span>
                        <Meter value={r.score} color={TIER_VAR[r.tier]} delay={(showMap ? 420 : 160) + i * 50} />
                      </div>
                    )}
                  </td>
                  <td className="hidden px-3 py-3 text-right tnum sm:table-cell">{r.followers === null ? <span className="text-muted-foreground">—</span> : fmt.followers(r.followers)}</td>
                  <td className="hidden px-4 py-3 text-right tnum sm:table-cell sm:px-5">{r.engagement === null ? <span className="text-muted-foreground">—</span> : fmt.engagement(r.engagement)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        <p className="border-t px-4 py-2.5 text-xs text-muted-foreground sm:px-5">
          Competencia: {data.competitorsSource} · Redes: últimos posts públicos.
        </p>
      </div>
      ) : null}
    </section>
  )
}
