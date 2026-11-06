import { useCallback, useRef, useState } from "react"
import {
  ActivityIndicator,
  KeyboardAvoidingView,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
  type ScrollViewInstance,
} from "react-native"
import { SafeAreaView } from "react-native-safe-area-context"

import { BookingCard } from "@/components/BookingCard"
import { Prose } from "@/components/Prose"
import { Report } from "@/components/Report"
import { SlotChips } from "@/components/SlotChips"
import { analyze, type Place } from "@/lib/api"
import { chat, type ChatMessage, type Proposal, type Slot } from "@/lib/chat"
import { scoreAll } from "@/lib/metrics"
import { createPacer } from "@/lib/pacer"
import type { Dataset } from "@/lib/types"
import { colors, fonts, radius, shadow } from "@/theme"

type AssistantTurn = {
  id: string
  role: "assistant"
  query: string
  steps: string[]
  text: string
  choices?: { text: string; options: Place[]; chosenId?: string }
  data?: Dataset
  running: boolean
  error?: boolean
}
// A follow-up answer after the report: text, plus time slots or a booking card.
type ChatTurn = { id: string; role: "chat"; text: string; slots?: Slot[]; proposal?: Proposal; running: boolean; error?: boolean }
type Turn = { id: string; role: "user"; text: string } | AssistantTurn | ChatTurn

const SUGGESTIONS = ["¿Por qué tengo este puntaje?", "¿Qué hago primero?", "Quiero agendar una reunión"]

let counter = 0
const nextId = () => `t${++counter}`

// A warm halo behind the headline, the same motif as the score halo on the map.
function HeroGlow() {
  const disc = (size: number, opacity: number) => (
    <View
      key={size}
      style={{
        position: "absolute",
        width: size,
        height: size,
        borderRadius: size / 2,
        backgroundColor: colors.brand,
        opacity,
        top: 150 - size / 2,
        left: "50%",
        marginLeft: -size / 2,
      }}
    />
  )
  return (
    <View pointerEvents="none" style={StyleSheet.absoluteFill}>
      {[disc(420, 0.04), disc(320, 0.05), disc(220, 0.07), disc(130, 0.09)]}
    </View>
  )
}

export default function Home() {
  const [turns, setTurns] = useState<Turn[]>([])
  const [draft, setDraft] = useState("")
  const [busy, setBusy] = useState(false)
  const abortRef = useRef<AbortController | null>(null)
  const scrollRef = useRef<ScrollViewInstance>(null)

  const patch = useCallback((id: string, fn: (t: AssistantTurn) => Partial<AssistantTurn>) => {
    setTurns((prev) => prev.map((t) => (t.id === id && t.role === "assistant" ? { ...t, ...fn(t) } : t)))
  }, [])

  const run = useCallback(
    async (query: string, pick?: { placeId: string; label: string }) => {
      if (!query || busy) return
      setDraft("")
      setBusy(true)

      const id = nextId()
      setTurns((prev) => [
        ...prev,
        { id: nextId(), role: "user", text: pick?.label ?? query },
        { id, role: "assistant", query, steps: [], text: "", running: true },
      ])

      const controller = new AbortController()
      abortRef.current = controller

      const pacer = createPacer((visible) => patch(id, () => ({ text: visible })))
      // Scroll once, when the turn starts, so the new message is visible.
      setTimeout(() => scrollRef.current?.scrollToEnd({ animated: true }), 60)

      try {
        for await (const evt of analyze(query, { placeId: pick?.placeId, signal: controller.signal })) {
          if (evt.type === "status") {
            patch(id, (t) => ({ steps: t.steps[t.steps.length - 1] === evt.text ? t.steps : [...t.steps, evt.text] }))
          } else if (evt.type === "data") {
            patch(id, () => ({ data: evt.data }))
          } else if (evt.type === "text") {
            pacer.push(evt.text)
          } else if (evt.type === "choices") {
            patch(id, () => ({ choices: { text: evt.text, options: evt.options } }))
            setTimeout(() => scrollRef.current?.scrollToEnd({ animated: true }), 60)
          } else {
            patch(id, () => ({ text: evt.text, error: true }))
          }
        }
        await pacer.drain()
        patch(id, () => ({ running: false }))
      } catch (e) {
        const rest = pacer.text
        patch(id, (t) => ({ text: t.error ? t.text : rest }))
        if (controller.signal.aborted) {
          patch(id, () => ({ running: false }))
        } else {
          patch(id, () => ({ text: e instanceof Error ? e.message : "Error inesperado", error: true, running: false }))
        }
      } finally {
        pacer.stop()
        abortRef.current = null
        setBusy(false)
      }
    },
    [busy, patch]
  )

  const pickPlace = (turn: AssistantTurn, place: Place) => {
    if (busy) return
    setTurns((prev) =>
      prev.map((t) =>
        t.id === turn.id && t.role === "assistant" && t.choices ? { ...t, choices: { ...t.choices, chosenId: place.id } } : t
      )
    )
    void run(turn.query, { placeId: place.id, label: `${place.name} · ${place.address}` })
  }

  // The latest report: once it exists, the composer talks to the assistant about it.
  const report = [...turns].reverse().find((t): t is AssistantTurn => t.role === "assistant" && !!t.data)
  const lastId = turns[turns.length - 1]?.id

  const patchChat = useCallback((id: string, fn: (t: ChatTurn) => Partial<ChatTurn>) => {
    setTurns((prev) => prev.map((t) => (t.id === id && t.role === "chat" ? { ...t, ...fn(t) } : t)))
  }, [])

  const ask = useCallback(
    async (text: string) => {
      if (!text || busy || !report?.data) return
      setDraft("")
      setBusy(true)

      // What the server needs: everything said after the report.
      const history: ChatMessage[] = []
      for (const t of turns.slice(turns.findIndex((x) => x.id === report.id) + 1)) {
        if (t.role === "user") history.push({ role: "user", content: t.text })
        else if (t.role === "chat" && t.text) history.push({ role: "assistant", content: t.text })
      }
      history.push({ role: "user", content: text })

      const id = nextId()
      setTurns((prev) => [...prev, { id: nextId(), role: "user", text }, { id, role: "chat", text: "", running: true }])
      setTimeout(() => scrollRef.current?.scrollToEnd({ animated: true }), 60)

      const controller = new AbortController()
      abortRef.current = controller
      const pacer = createPacer((visible) => patchChat(id, () => ({ text: visible })))
      try {
        for await (const evt of chat({ messages: history, dataset: report.data, analysisText: report.text }, controller.signal)) {
          if (evt.type === "text") {
            pacer.push(evt.text)
          } else if (evt.type === "status") {
            if (!pacer.text) patchChat(id, () => ({ text: evt.text }))
          } else if (evt.type === "slots") {
            patchChat(id, () => ({ slots: evt.slots }))
            setTimeout(() => scrollRef.current?.scrollToEnd({ animated: true }), 120)
          } else if (evt.type === "proposal") {
            patchChat(id, () => ({ proposal: evt.proposal }))
            setTimeout(() => scrollRef.current?.scrollToEnd({ animated: true }), 120)
          } else {
            patchChat(id, () => ({ text: evt.text, error: true }))
          }
        }
        await pacer.drain()
        patchChat(id, () => ({ running: false }))
      } catch (e) {
        const rest = pacer.text
        if (controller.signal.aborted) patchChat(id, (t) => ({ text: t.error ? t.text : rest, running: false }))
        else patchChat(id, () => ({ text: e instanceof Error ? e.message : "Error inesperado", error: true, running: false }))
      } finally {
        pacer.stop()
        abortRef.current = null
        setBusy(false)
      }
    },
    [busy, report, turns, patchChat]
  )

  const submit = () => (report ? void ask(draft.trim()) : void run(draft.trim()))

  const empty = turns.length === 0

  const composer = (
    <View style={styles.composer}>
      <TextInput
        value={draft}
        onChangeText={setDraft}
        placeholder={report ? "Pregúntame sobre este análisis" : "Nombre y ciudad, o @usuario de Instagram"}
        placeholderTextColor={colors.mutedForeground}
        style={styles.input}
        returnKeyType="send"
        onSubmitEditing={submit}
        autoCorrect={!!report}
        autoCapitalize={report ? "sentences" : "none"}
        editable={!busy}
      />
      <Pressable
        accessibilityRole="button"
        accessibilityLabel={busy ? "Detener" : report ? "Enviar" : "Analizar"}
        onPress={() => (busy ? abortRef.current?.abort() : submit())}
        disabled={!busy && !draft.trim()}
        style={({ pressed }) => [styles.send, (!busy && !draft.trim()) && { opacity: 0.35 }, pressed && { opacity: 0.8 }]}
      >
        <Text style={styles.sendText}>{busy ? "■" : "↑"}</Text>
      </Pressable>
    </View>
  )

  return (
    <SafeAreaView style={styles.screen} edges={["top", "bottom"]}>
      <KeyboardAvoidingView style={{ flex: 1 }} behavior={Platform.OS === "ios" ? "padding" : undefined}>
        <View style={styles.header}>
          <Text style={styles.brand}>Atrium</Text>
          {empty ? null : (
            <Pressable onPress={() => !busy && setTurns([])} disabled={busy} accessibilityRole="button">
              <Text style={[styles.link, busy && { opacity: 0.4 }]}>Nuevo análisis</Text>
            </Pressable>
          )}
        </View>

        {empty ? (
          <View style={styles.hero}>
            <HeroGlow />
            <Text style={styles.title}>¿Cómo está tu negocio frente a la competencia?</Text>
            <Text style={styles.subtitle}>
              Escribe el nombre con la ciudad, o su @ de Instagram, que es más preciso. Comparo su Google e Instagram con los negocios de su
              entorno.
            </Text>
            <View style={{ alignSelf: "stretch" }}>{composer}</View>
          </View>
        ) : (
          <>
            <ScrollView ref={scrollRef} style={{ flex: 1 }} contentContainerStyle={styles.thread} keyboardShouldPersistTaps="handled">
              {turns.map((t) =>
                t.role === "user" ? (
                  <View key={t.id} style={styles.userBubble}>
                    <Text style={styles.userText}>{t.text}</Text>
                  </View>
                ) : t.role === "chat" ? (
                  <View key={t.id} style={{ gap: 14 }}>
                    {t.error ? (
                      <Text style={[styles.body, { color: colors.destructive }]}>{t.text}</Text>
                    ) : t.text ? (
                      <Prose text={t.text} streaming={t.running} />
                    ) : !t.slots && !t.proposal ? (
                      <View style={styles.step}>
                        <ActivityIndicator size="small" color={colors.brand} />
                        <Text style={[styles.stepText, { color: colors.foreground }]}>Pensando…</Text>
                      </View>
                    ) : null}
                    {t.slots ? <SlotChips slots={t.slots} disabled={busy || lastId !== t.id} onPick={(sl) => void ask(`Elijo ${sl.label}`)} /> : null}
                    {t.proposal && report?.data ? (
                      <BookingCard
                        proposal={t.proposal}
                        businessName={report.data.business.name}
                        score={scoreAll(report.data)[0]?.total ?? null}
                        active={lastId === t.id}
                        onConflict={() => void ask("Ese horario ya no está disponible, ¿qué otras opciones hay?")}
                      />
                    ) : null}
                  </View>
                ) : (
                  <View key={t.id} style={{ gap: 12 }}>
                    {t.choices ? (
                      <View style={{ gap: 8 }}>
                        <Text style={styles.question}>{t.choices.text}</Text>
                        {t.choices.options.map((o) => {
                          const chosen = t.choices?.chosenId === o.id
                          return (
                            <Pressable
                              key={o.id}
                              onPress={() => pickPlace(t, o)}
                              disabled={busy || (!!t.choices?.chosenId && !chosen)}
                              style={[styles.option, chosen && { borderColor: colors.foreground }, !!t.choices?.chosenId && !chosen && { opacity: 0.5 }]}
                            >
                              <View style={{ flex: 1 }}>
                                <Text style={styles.optionName}>{o.name}</Text>
                                <Text style={styles.optionAddress}>{o.address}</Text>
                              </View>
                              {o.rating ? <Text style={styles.optionRating}>★ {o.rating.toFixed(1)}</Text> : null}
                            </Pressable>
                          )
                        })}
                      </View>
                    ) : t.data ? (
                      // The written analysis sits inside the report, right after the score.
                      <Report data={t.data} settled={!t.running}>
                        {t.error ? (
                          <Text style={[styles.body, { color: colors.destructive }]}>{t.text}</Text>
                        ) : t.text ? (
                          <Prose text={t.text} streaming={t.running} />
                        ) : (
                          <View style={styles.step}>
                            <ActivityIndicator size="small" color={colors.brand} />
                            <Text style={[styles.stepText, { color: colors.foreground }]}>Escribiendo el análisis…</Text>
                          </View>
                        )}
                      </Report>
                    ) : (
                      <>
                        {t.steps.map((s, i) => {
                          const current = t.running && !t.text && i === t.steps.length - 1
                          return (
                            <View key={`${i}-${s}`} style={styles.step}>
                              {current ? <ActivityIndicator size="small" color={colors.brand} /> : <Text style={styles.check}>✓</Text>}
                              <Text style={[styles.stepText, current && { color: colors.foreground }]}>{s}</Text>
                            </View>
                          )
                        })}
                        {t.text ? <Text style={[styles.body, t.error && { color: colors.destructive }]}>{t.text}</Text> : null}
                      </>
                    )}
                  </View>
                )
              )}
            </ScrollView>
            <View style={styles.footer}>
              {report && !busy && !turns.some((t) => t.role === "chat") ? (
                <ScrollView horizontal showsHorizontalScrollIndicator={false} keyboardShouldPersistTaps="handled" contentContainerStyle={styles.suggestions} style={{ flexGrow: 0 }}>
                  {SUGGESTIONS.map((q) => (
                    <Pressable key={q} onPress={() => void ask(q)} accessibilityRole="button" style={({ pressed }) => [styles.suggestion, pressed && { backgroundColor: colors.muted }]}>
                      <Text style={styles.suggestionText}>{q}</Text>
                    </Pressable>
                  ))}
                </ScrollView>
              ) : null}
              {composer}
            </View>
          </>
        )}
      </KeyboardAvoidingView>
    </SafeAreaView>
  )
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: colors.background },
  header: { height: 52, paddingHorizontal: 20, flexDirection: "row", alignItems: "center", justifyContent: "space-between" },
  brand: { fontFamily: fonts.display, fontSize: 20, color: colors.foreground },
  link: { fontFamily: fonts.medium, fontSize: 14, color: colors.mutedForeground },
  hero: { flex: 1, justifyContent: "center", alignItems: "center", paddingHorizontal: 24, paddingBottom: 80, gap: 14 },
  title: { fontFamily: fonts.display, fontSize: 36, lineHeight: 40, textAlign: "center", color: colors.foreground },
  subtitle: { fontFamily: fonts.regular, fontSize: 15, lineHeight: 22, textAlign: "center", color: colors.mutedForeground, marginBottom: 10 },
  composer: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: colors.card,
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: radius.pill,
    paddingLeft: 18,
    paddingRight: 6,
    height: 56,
    gap: 8,
    ...shadow,
  },
  input: { flex: 1, fontFamily: fonts.regular, fontSize: 15, color: colors.foreground },
  send: { width: 42, height: 42, borderRadius: radius.pill, backgroundColor: colors.foreground, alignItems: "center", justifyContent: "center" },
  sendText: { color: colors.background, fontSize: 18, fontFamily: fonts.semibold },
  thread: { paddingHorizontal: 20, paddingVertical: 12, gap: 22 },
  footer: { paddingHorizontal: 16, paddingBottom: 8, paddingTop: 6, gap: 10 },
  suggestions: { gap: 8, paddingRight: 8 },
  suggestion: { borderWidth: 1, borderColor: colors.border, backgroundColor: colors.card, borderRadius: radius.pill, paddingHorizontal: 14, minHeight: 38, justifyContent: "center" },
  suggestionText: { fontFamily: fonts.medium, fontSize: 14, color: colors.foreground },
  userBubble: { alignSelf: "flex-end", backgroundColor: colors.muted, borderRadius: radius.lg, paddingHorizontal: 14, paddingVertical: 10, maxWidth: "85%" },
  userText: { fontFamily: fonts.regular, fontSize: 15, color: colors.foreground },
  question: { fontFamily: fonts.display, fontSize: 20, lineHeight: 26, color: colors.foreground },
  option: {
    flexDirection: "row",
    alignItems: "center",
    gap: 10,
    backgroundColor: colors.card,
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: radius.md,
    paddingHorizontal: 14,
    paddingVertical: 12,
  },
  optionName: { fontFamily: fonts.medium, fontSize: 15, color: colors.foreground },
  optionAddress: { fontFamily: fonts.regular, fontSize: 13, color: colors.mutedForeground, marginTop: 2 },
  optionRating: { fontFamily: fonts.medium, fontSize: 13, color: colors.foreground },
  step: { flexDirection: "row", alignItems: "center", gap: 12, paddingVertical: 2 },
  check: { width: 20, textAlign: "center", color: colors.positive, fontFamily: fonts.semibold },
  stepText: { flex: 1, fontFamily: fonts.regular, fontSize: 14, color: colors.mutedForeground },
  body: { fontFamily: fonts.regular, fontSize: 15, lineHeight: 23, color: colors.foreground },
})
