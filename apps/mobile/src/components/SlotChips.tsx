import { Pressable, StyleSheet, Text, View } from "react-native"

import type { Slot } from "@/lib/chat"
import { colors, fonts, radius, tabular } from "@/theme"

const cap = (s: string) => s.charAt(0).toUpperCase() + s.slice(1)

// Real free times from the agency calendar. Tapping one tells the assistant which one.
export function SlotChips({ slots, disabled, onPick }: { slots: Slot[]; disabled: boolean; onPick: (s: Slot) => void }) {
  // Labels look like "viernes, 6 de noviembre, 9:00 a.m. (EST)": day in the heading, time on the button.
  const days = new Map<string, Slot[]>()
  for (const s of slots) {
    const [weekday, date] = s.label.split(", ")
    const key = `${weekday} ${date}`
    days.set(key, [...(days.get(key) ?? []), s])
  }
  const zone = slots[0]?.label.match(/\(([^)]+)\)\s*$/)?.[1]
  return (
    <View style={{ gap: 14 }}>
      {[...days.entries()].map(([day, list]) => (
        <View key={day} style={{ gap: 8 }}>
          <Text style={styles.day}>{cap(day)}</Text>
          <View style={styles.row}>
            {list.map((s) => {
              const time = (s.label.split(", ")[2] ?? s.label).replace(/\s*\([^)]*\)\s*$/, "")
              return (
                <Pressable
                  key={s.start}
                  accessibilityRole="button"
                  accessibilityLabel={s.label}
                  disabled={disabled}
                  onPress={() => onPick(s)}
                  style={({ pressed }) => [styles.chip, disabled && { opacity: 0.5 }, pressed && { backgroundColor: colors.muted }]}
                >
                  <Text style={styles.time}>{time}</Text>
                </Pressable>
              )
            })}
          </View>
        </View>
      ))}
      {zone ? <Text style={styles.zone}>Horarios en hora del {zone === "EST" || zone === "EDT" ? "Este de EE. UU." : zone} ({zone}).</Text> : null}
    </View>
  )
}

const styles = StyleSheet.create({
  day: { fontFamily: fonts.medium, fontSize: 14, color: colors.foreground },
  row: { flexDirection: "row", flexWrap: "wrap", gap: 8 },
  chip: {
    minHeight: 44,
    justifyContent: "center",
    paddingHorizontal: 16,
    borderRadius: radius.pill,
    borderWidth: 1,
    borderColor: colors.border,
    backgroundColor: colors.card,
  },
  time: { fontFamily: fonts.medium, fontSize: 14, color: colors.foreground, ...tabular },
  zone: { fontFamily: fonts.regular, fontSize: 12, color: colors.mutedForeground },
})
