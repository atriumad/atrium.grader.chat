import { memo, useMemo, useState, type ReactNode } from "react"
import { Pressable, StyleSheet, Text, View } from "react-native"

import { Meter } from "@/components/Meter"
import { Reveal } from "@/components/Reveal"
import { ResultsMap, type MapPoint } from "@/components/ResultsMap"
import type { Dataset } from "@/lib/types"
import {
  CONFIDENCE_LABEL,
  PART_LABEL,
  SCORE_CONFIG,
  TIER_LABEL,
  benchmarks,
  fmt,
  rivalsAverage,
  tierOf,
  toRows,
  type Benchmark,
  type Row,
} from "@/lib/metrics"
import { colors, fonts, radius, shadow, tabular } from "@/theme"

function mapPoints(rows: Row[]): MapPoint[] {
  const pts: MapPoint[] = rows
    .filter((r): r is Row & { lat: number; lng: number } => r.lat !== null && r.lng !== null)
    .map((r) => ({
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

// The shadow lives on an outer view: iOS clips it on a view that has overflow hidden.
function Card({ title, children, footer }: { title?: string; children: ReactNode; footer?: string }) {
  return (
    <View style={styles.cardShadow}>
      <View style={styles.cardInner}>
        {title ? <Text style={styles.cardTitle}>{title}</Text> : null}
        {children}
        {footer ? <Text style={styles.cardFooter}>{footer}</Text> : null}
      </View>
    </View>
  )
}

// Soft glow in the score colour, built from translucent discs (no radial gradient in RN).
function Glow({ color }: { color: string }) {
  const disc = (size: number, opacity: number) => (
    <View
      key={size}
      style={{
        position: "absolute",
        width: size,
        height: size,
        borderRadius: size / 2,
        backgroundColor: color,
        opacity,
        top: 50 - size / 2,
        left: 60 - size / 2,
      }}
    />
  )
  return (
    <View pointerEvents="none" style={StyleSheet.absoluteFill}>
      {[disc(300, 0.06), disc(230, 0.09), disc(160, 0.13), disc(100, 0.2)]}
    </View>
  )
}

const ScorePanel = memo(function ScorePanel({ you, total, avg, bench }: { you: Row; total: number; avg: number | null; bench: Benchmark[] }) {
  const [open, setOpen] = useState(false)
  const tierColor = colors.tier[you.tier]
  const diff = you.score !== null && avg !== null ? Math.round(you.score - avg) : null
  const w = SCORE_CONFIG.weights
  const cfg = SCORE_CONFIG
  return (
    <View style={styles.cardShadow}>
      <View style={styles.cardInner}>
        <View style={styles.scoreTop}>
          <Glow color={tierColor} />
          <View style={{ gap: 8, flexShrink: 1 }}>
            <Text style={styles.muted}>Puntaje Atrium</Text>
            <View style={{ flexDirection: "row", alignItems: "baseline", gap: 6 }}>
              <Text style={[styles.bigScore, tabular]}>{you.score ?? "—"}</Text>
              {you.score !== null ? <Text style={styles.outOf}>/100</Text> : null}
            </View>
            <View style={styles.tierPill}>
              <View style={[styles.dot, { backgroundColor: tierColor }]} />
              <Text style={styles.tierText}>{TIER_LABEL[you.tier]}</Text>
            </View>
            <Text style={styles.confidence}>
              Confianza {CONFIDENCE_LABEL[you.confidence.level]}
              {you.confidence.level !== "high" && you.missing.length > 0
                ? ` · provisional: faltan datos de ${you.missing.map((k) => PART_LABEL[k].toLowerCase()).join(", ")}`
                : ""}
            </Text>
          </View>
          <View style={styles.rankBox}>
            <Text style={styles.muted}>Puesto</Text>
            <Text style={[styles.rankBig, tabular]}>
              {you.rank}
              <Text style={styles.rankOf}> / {total}</Text>
            </Text>
            {avg !== null ? (
              <Text style={[styles.rankAvg, tabular]}>
                Competencia {avg}
                {diff !== null && diff !== 0 ? (
                  <Text style={{ color: diff > 0 ? colors.positive : colors.brand }}> ({diff > 0 ? "+" : "−"}{Math.abs(diff)})</Text>
                ) : null}
              </Text>
            ) : null}
          </View>
        </View>

        {bench.map((b, i) => (
          <View key={b.key} style={styles.partRow}>
            <View style={styles.partHead}>
              <Text style={styles.partLabel}>{b.label}</Text>
              <Text style={[styles.partScore, tabular]}>{b.you === null ? "—" : Math.round(b.you)}</Text>
            </View>
            <Meter value={b.you} mark={b.avg} color={b.you === null ? colors.tier.none : colors.tier[tierOf(b.you)]} delay={i * 80} />
            <Text style={[styles.partRaw, tabular]}>
              {b.rawLabel}: <Text style={{ color: colors.foreground, fontFamily: fonts.medium }}>{b.rawYou}</Text>
              {b.rawAvg ? ` · competencia ${b.rawAvg}` : ""}
            </Text>
          </View>
        ))}

        <View style={styles.markNote}>
          <View style={styles.markTick} />
          <Text style={styles.markText}>La marca indica el promedio de la competencia</Text>
        </View>

        <Pressable onPress={() => setOpen((o) => !o)} accessibilityRole="button" style={styles.howBtn}>
          <Text style={styles.howText}>{open ? "▾" : "▸"} Cómo se calcula el puntaje</Text>
        </Pressable>
        {open ? (
          <View style={styles.how}>
            <Text style={styles.howBody}>
              Nota de 0 a 100 con cinco señales: engagement {w.engagement}%, reputación {w.reputation}%, actividad {w.activity}%, audiencia{" "}
              {w.audience}% y presencia {w.presence}%. Las señales sociales (Instagram, Facebook, TikTok y YouTube, las que tenga el negocio) suman un {100 - w.reputation}% y Google un {w.reputation}%. Si falta una señal se calcula con las demás (hacen falta al
              menos dos) y la confianza lo indica.
            </Text>
            <Text style={styles.howBody}>
              Engagement se compara con lo esperable para el tamaño de la cuenta (4% bajo 5 mil seguidores, 3% hasta 20 mil, 2% hasta 100 mil y
              1.2% por encima): igualarlo da unos 67 puntos y superarlo 1.5 veces da 100. Si hay vistas, cuentan un {cfg.engagement.viewsShare * 100}%.
              Reputación usa un promedio bayesiano del rating (un 5.0 con pocas reseñas no vale como uno con miles) y el volumen de reseñas.
              Actividad mezcla la frecuencia (hasta {cfg.activity.postsPerWeekFull} posts por semana, un 60%) con lo reciente que es el último post
              (40%). Audiencia va de {cfg.audience.followersFloor.toLocaleString("es")} a {cfg.audience.followersFull.toLocaleString("es")}{" "}
              seguidores en escala logarítmica.
            </Text>
            <Text style={styles.howBody}>
              Verde desde {cfg.tiers.good}, naranja desde {cfg.tiers.medium}, rojo por debajo. Son criterios propios de Atrium, no un estándar de la
              industria.
            </Text>
          </View>
        ) : null}
      </View>
    </View>
  )
})

const RankRow = memo(function RankRow({ r, active, onPress }: { r: Row; active: boolean; onPress: () => void }) {
  const details = [
    r.followers !== null ? `${fmt.followers(r.followers)} seguidores` : null,
    r.engagement !== null ? `${fmt.engagement(r.engagement)} engagement` : null,
  ].filter(Boolean)
  const c = colors.tier[r.tier]
  return (
    <Pressable onPress={onPress} style={[styles.rankRow, (active || r.isYou) && { backgroundColor: colors.muted }]}>
      <View style={[styles.rankBadge, { backgroundColor: r.isYou ? colors.foreground : colors.brand }]}>
        <Text style={styles.rankBadgeText}>{r.rank}</Text>
      </View>
      <View style={{ flex: 1, gap: 6 }}>
        <View style={{ flexDirection: "row", alignItems: "center", gap: 8, flexWrap: "wrap" }}>
          <Text style={styles.rankName}>{r.name}</Text>
          {r.isYou ? (
            <View style={styles.youPill}>
              <Text style={styles.youText}>Tú</Text>
            </View>
          ) : null}
        </View>
        {r.handle ? <Text style={styles.rankSub}>@{r.handle}</Text> : null}
        {r.score !== null ? <Meter value={r.score} color={c} /> : null}
        {details.length ? <Text style={[styles.rankSub, tabular]}>{details.join(" · ")}</Text> : null}
        {r.note ? <Text style={styles.rankSub}>{r.note}</Text> : null}
      </View>
      <View style={[styles.scoreChip, { backgroundColor: `${c}24` }]}>
        <View style={[styles.dotSm, { backgroundColor: c }]} />
        <Text style={[styles.scoreChipText, tabular]}>{r.score ?? "—"}</Text>
      </View>
    </Pressable>
  )
})

// `children` is the written analysis: it sits right after the score, before the evidence.
// `settled` becomes true when the analysis has finished streaming. Until then the map and
// the ranking are not rendered at all, so the text can grow without pushing anything around.
export function Report({ data, children, settled = true }: { data: Dataset; children?: ReactNode; settled?: boolean }) {
  const rows = useMemo(() => toRows(data), [data])
  const bench = useMemo(() => benchmarks(rows), [rows])
  const you = rows.find((r) => r.isYou)!
  const avg = useMemo(() => rivalsAverage(rows), [rows])
  const points = useMemo(() => mapPoints(rows), [rows])
  const [active, setActive] = useState<string | null>(null)

  return (
    <View style={{ gap: 28 }}>
      <Reveal>
        <View style={{ gap: 14 }}>
          <View style={{ gap: 4 }}>
            <Text style={styles.name}>{you.name}</Text>
            <Text style={styles.identification}>{data.identification}</Text>
          </View>
          <ScorePanel you={you} total={rows.length} avg={avg} bench={bench} />
        </View>
      </Reveal>

      {children}

      {settled ? (
        <>
          {points.length > 0 ? (
            <Reveal>
              <Card title="Dónde compites" footer="Halo = puntaje · tamaño = audiencia total en redes. Toca un pin para el detalle.">
                <ResultsMap points={points} activeKey={active} onActive={setActive} />
              </Card>
            </Reveal>
          ) : null}
          <Reveal delay={120}>
            <Card title="Ranking de tu zona" footer={`Competencia: ${data.competitorsSource} · Redes: últimos posts públicos.`}>
              {rows.map((r) => (
                <RankRow key={r.key} r={r} active={active === r.key} onPress={() => setActive((a) => (a === r.key ? null : r.key))} />
              ))}
            </Card>
          </Reveal>
        </>
      ) : null}
    </View>
  )
}

const styles = StyleSheet.create({
  name: { fontFamily: fonts.display, fontSize: 32, lineHeight: 37, color: colors.foreground },
  identification: { fontFamily: fonts.regular, fontSize: 13, lineHeight: 19, color: colors.mutedForeground },
  cardShadow: { borderRadius: radius.lg, backgroundColor: colors.card, ...shadow },
  cardInner: { borderRadius: radius.lg, borderWidth: 1, borderColor: colors.border, overflow: "hidden", backgroundColor: colors.card },
  cardTitle: {
    fontFamily: fonts.medium,
    fontSize: 14,
    color: colors.foreground,
    paddingHorizontal: 16,
    paddingVertical: 13,
    borderBottomWidth: 1,
    borderBottomColor: colors.border,
  },
  cardFooter: {
    fontFamily: fonts.regular,
    fontSize: 12,
    lineHeight: 17,
    color: colors.mutedForeground,
    paddingHorizontal: 16,
    paddingVertical: 10,
    borderTopWidth: 1,
    borderTopColor: colors.border,
  },
  muted: { fontFamily: fonts.regular, fontSize: 14, color: colors.mutedForeground },
  dot: { width: 10, height: 10, borderRadius: 5 },
  dotSm: { width: 8, height: 8, borderRadius: 4 },
  scoreTop: {
    padding: 18,
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "flex-start",
    gap: 12,
    borderBottomWidth: 1,
    borderBottomColor: colors.border,
  },
  bigScore: { fontFamily: fonts.display, fontSize: 76, lineHeight: 80, color: colors.foreground },
  outOf: { fontFamily: fonts.regular, fontSize: 18, color: colors.mutedForeground },
  tierPill: {
    alignSelf: "flex-start",
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
    borderWidth: 1,
    borderColor: colors.border,
    backgroundColor: "rgba(253,251,246,0.9)",
    borderRadius: radius.pill,
    paddingHorizontal: 12,
    paddingVertical: 5,
  },
  tierText: { fontFamily: fonts.medium, fontSize: 14, color: colors.foreground },
  confidence: { fontFamily: fonts.regular, fontSize: 12, lineHeight: 17, color: colors.mutedForeground, maxWidth: 190 },
  rankBox: { alignItems: "flex-end", gap: 2, paddingTop: 2 },
  rankBig: { fontFamily: fonts.display, fontSize: 40, lineHeight: 44, color: colors.foreground },
  rankOf: { fontFamily: fonts.regular, fontSize: 16, color: colors.mutedForeground },
  rankAvg: { fontFamily: fonts.regular, fontSize: 12, color: colors.mutedForeground, marginTop: 4 },
  partRow: { paddingHorizontal: 18, paddingVertical: 14, gap: 9, borderBottomWidth: 1, borderBottomColor: colors.border },
  partHead: { flexDirection: "row", alignItems: "baseline", justifyContent: "space-between" },
  partLabel: { fontFamily: fonts.medium, fontSize: 15, color: colors.foreground },
  partScore: { fontFamily: fonts.display, fontSize: 24, color: colors.foreground },
  partRaw: { fontFamily: fonts.regular, fontSize: 12, color: colors.mutedForeground },
  markNote: { flexDirection: "row", alignItems: "center", gap: 8, paddingHorizontal: 18, paddingVertical: 11 },
  markTick: { width: 2, height: 12, borderRadius: 1, backgroundColor: colors.brand },
  markText: { fontFamily: fonts.regular, fontSize: 12, color: colors.mutedForeground },
  howBtn: { borderTopWidth: 1, borderTopColor: colors.border, paddingHorizontal: 18, paddingVertical: 14 },
  howText: { fontFamily: fonts.regular, fontSize: 14, color: colors.mutedForeground },
  how: { paddingHorizontal: 18, paddingBottom: 14, gap: 8 },
  howBody: { fontFamily: fonts.regular, fontSize: 13, lineHeight: 19, color: colors.mutedForeground },
  rankRow: { flexDirection: "row", alignItems: "flex-start", gap: 12, paddingHorizontal: 16, paddingVertical: 14, borderTopWidth: 1, borderTopColor: colors.border },
  rankBadge: { width: 26, height: 26, borderRadius: 13, alignItems: "center", justifyContent: "center", marginTop: 1 },
  rankBadgeText: { color: colors.card, fontFamily: fonts.semibold, fontSize: 12 },
  rankName: { fontFamily: fonts.medium, fontSize: 15, color: colors.foreground, flexShrink: 1 },
  rankSub: { fontFamily: fonts.regular, fontSize: 12, color: colors.mutedForeground },
  scoreChip: { flexDirection: "row", alignItems: "center", gap: 6, borderRadius: radius.pill, paddingHorizontal: 10, paddingVertical: 5, minWidth: 54, justifyContent: "center" },
  scoreChipText: { fontFamily: fonts.semibold, fontSize: 15, color: colors.foreground },
  youPill: { backgroundColor: colors.foreground, borderRadius: radius.pill, paddingHorizontal: 8, paddingVertical: 2 },
  youText: { color: colors.background, fontFamily: fonts.medium, fontSize: 11 },
})
