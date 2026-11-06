import { useEffect, useRef } from "react"
import { Animated, Easing, StyleSheet, View } from "react-native"

import { colors } from "@/theme"

// A bar that grows from zero when it appears. `mark` draws a thin tick (the competitors' average).
export function Meter({
  value,
  mark,
  color = colors.foreground,
  delay = 0,
}: {
  value: number | null
  mark?: number | null
  color?: string
  delay?: number
}) {
  const pct = value === null ? 0 : Math.max(2, Math.min(100, value))
  const scale = useRef(new Animated.Value(0)).current

  useEffect(() => {
    Animated.timing(scale, {
      toValue: pct / 100,
      duration: 900,
      delay,
      easing: Easing.out(Easing.cubic),
      useNativeDriver: true,
    }).start()
  }, [pct, delay, scale])

  return (
    <View style={styles.wrap}>
      <View style={styles.track}>
        <Animated.View style={[styles.fill, { backgroundColor: color, transform: [{ scaleX: scale }], transformOrigin: "left center" }]} />
      </View>
      {mark != null ? <View style={[styles.mark, { left: `${Math.max(0, Math.min(100, mark))}%` }]} /> : null}
    </View>
  )
}

const styles = StyleSheet.create({
  wrap: { height: 6, justifyContent: "center" },
  track: { height: 6, borderRadius: 3, backgroundColor: colors.muted, overflow: "hidden" },
  fill: { height: 6, width: "100%", borderRadius: 3 },
  mark: { position: "absolute", top: -4, width: 2, height: 14, marginLeft: -1, borderRadius: 1, backgroundColor: colors.brand },
})
