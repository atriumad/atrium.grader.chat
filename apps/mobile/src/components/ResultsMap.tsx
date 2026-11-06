import { useCallback, useEffect, useRef, useState } from "react"
import { StyleSheet, Text, View } from "react-native"
import MapView, { Callout, Marker } from "react-native-maps"

import { TIER_LABEL, fmt, type Tier } from "@/lib/metrics"
import { colors, fonts, radius } from "@/theme"

export type MapPoint = {
  key: string
  rank: number
  isYou: boolean
  name: string
  lat: number
  lng: number
  score: number | null
  tier: Tier
  rating: number | null
  reviews: number | null
  followers: number | null
  engagement: number | null
}

// Pin diameter grows with Instagram audience (log scale), so reach reads at a glance.
function pinSize(p: MapPoint): number {
  if (p.isYou) return 40
  if (!p.followers || p.followers <= 0) return 28
  const t = Math.max(0, Math.min(1, (Math.log10(p.followers) - 3) / 2))
  return Math.round(28 + t * 10)
}

// Score halo: two translucent discs in the tier colour behind a ringed pin.
function Pin({ p, active }: { p: MapPoint; active: boolean }) {
  const s = pinSize(p)
  const box = Math.round(s * (active ? 2.7 : 2.2))
  const c = colors.tier[p.tier]
  return (
    <View style={{ width: box, height: box, alignItems: "center", justifyContent: "center" }}>
      <View style={[styles.disc, { width: box, height: box, borderRadius: box / 2, backgroundColor: c, opacity: 0.2 }]} />
      <View style={[styles.disc, { width: box * 0.72, height: box * 0.72, borderRadius: box, backgroundColor: c, opacity: 0.32 }]} />
      <View style={{ width: s + 8, height: s + 8, borderRadius: (s + 8) / 2, borderWidth: 2, borderColor: c, alignItems: "center", justifyContent: "center" }}>
        <View
          style={[
            styles.pin,
            { width: s, height: s, borderRadius: s / 2, backgroundColor: p.isYou ? colors.foreground : colors.brand },
            active && { borderColor: colors.foreground },
          ]}
        >
          <Text style={styles.pinText}>{p.isYou ? "Tú" : p.rank}</Text>
        </View>
      </View>
    </View>
  )
}

export function ResultsMap({
  points,
  activeKey,
  onActive,
}: {
  points: MapPoint[]
  activeKey: string | null
  onActive: (key: string | null) => void
}) {
  const ref = useRef<MapView>(null)

  // Custom marker views are bitmaps: redraw them only briefly after mount and when the
  // highlight changes. Leaving this on makes the map re-render continuously.
  const [track, setTrack] = useState(true)
  useEffect(() => {
    setTrack(true)
    const id = setTimeout(() => setTrack(false), 600)
    return () => clearTimeout(id)
  }, [activeKey])

  const fit = useCallback(() => {
    ref.current?.fitToCoordinates(
      points.map((p) => ({ latitude: p.lat, longitude: p.lng })),
      { edgePadding: { top: 80, right: 70, bottom: 80, left: 70 }, animated: false }
    )
  }, [points])

  useEffect(() => {
    const id = setTimeout(fit, 300)
    return () => clearTimeout(id)
  }, [fit])

  return (
    <View style={styles.wrap}>
      <MapView
        ref={ref}
        style={StyleSheet.absoluteFill}
        onMapReady={fit}
        onPress={() => onActive(null)}
        rotateEnabled={false}
        pitchEnabled={false}
        toolbarEnabled={false}
        showsPointsOfInterests={false}
      >
        {points.map((p) => (
          <Marker
            key={p.key}
            coordinate={{ latitude: p.lat, longitude: p.lng }}
            anchor={{ x: 0.5, y: 0.5 }}
            tracksViewChanges={track}
            zIndex={p.isYou ? 1000 : Math.round(p.score ?? 0)}
            onPress={() => onActive(p.key)}
          >
            <Pin p={p} active={activeKey === p.key} />
            <Callout tooltip>
              <View style={styles.callout}>
                <Text style={styles.calloutName}>
                  {p.name}
                  {p.isYou ? " (tú)" : ""}
                </Text>
                <View style={styles.calloutRow}>
                  <View style={[styles.dot, { backgroundColor: colors.tier[p.tier] }]} />
                  <Text style={styles.calloutScore}>
                    {p.score === null ? "Sin puntaje" : `Puntaje ${p.score}`} · {TIER_LABEL[p.tier]}
                  </Text>
                </View>
                {p.rating ? (
                  <Text style={styles.calloutLine}>
                    ★ {fmt.rating(p.rating)}
                    {p.reviews ? ` (${p.reviews.toLocaleString("es")} reseñas)` : ""}
                  </Text>
                ) : null}
                {p.followers ? <Text style={styles.calloutLine}>{fmt.followers(p.followers)} seguidores</Text> : null}
                {p.engagement !== null ? <Text style={styles.calloutLine}>{fmt.engagement(p.engagement)} de engagement</Text> : null}
              </View>
            </Callout>
          </Marker>
        ))}
      </MapView>
      <View style={styles.legend} pointerEvents="none">
        {(["good", "medium", "low", "none"] as Tier[]).map((t) => (
          <View key={t} style={styles.legendItem}>
            <View style={[styles.dot, { backgroundColor: colors.tier[t] }]} />
            <Text style={styles.legendText}>{TIER_LABEL[t]}</Text>
          </View>
        ))}
      </View>
    </View>
  )
}

const styles = StyleSheet.create({
  wrap: { height: 340, backgroundColor: colors.muted },
  disc: { position: "absolute" },
  pin: { alignItems: "center", justifyContent: "center", borderWidth: 2, borderColor: colors.card },
  pinText: { color: colors.card, fontFamily: fonts.semibold, fontSize: 12 },
  callout: {
    minWidth: 190,
    backgroundColor: colors.card,
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: radius.md,
    padding: 12,
    gap: 3,
  },
  calloutName: { fontFamily: fonts.semibold, fontSize: 14, color: colors.foreground },
  calloutRow: { flexDirection: "row", alignItems: "center", gap: 6, marginTop: 2 },
  calloutScore: { fontFamily: fonts.medium, fontSize: 13, color: colors.foreground },
  calloutLine: { fontFamily: fonts.regular, fontSize: 12, color: colors.mutedForeground },
  dot: { width: 9, height: 9, borderRadius: 5 },
  legend: {
    position: "absolute",
    left: 10,
    bottom: 10,
    flexDirection: "row",
    gap: 10,
    backgroundColor: "rgba(253,251,246,0.95)",
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: radius.pill,
    paddingHorizontal: 10,
    paddingVertical: 5,
  },
  legendItem: { flexDirection: "row", alignItems: "center", gap: 4 },
  legendText: { fontFamily: fonts.regular, fontSize: 11, color: colors.foreground },
})
