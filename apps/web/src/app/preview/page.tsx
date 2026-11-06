"use client"

import * as React from "react"
import { IconLoader2 } from "@tabler/icons-react"

import {
  PromptInput,
  PromptInputActions,
  PromptInputBody,
  PromptInputSubmit,
  PromptInputTextarea,
  type PromptMessage,
} from "@/components/blocks/prompt-input/prompt-input"
import { Prose } from "@/components/results/prose"
import { Report } from "@/components/results/report"
import { Steps } from "@/components/results/steps"
import { Bubble, BubbleContent } from "@/components/ui/bubble"
import { Button } from "@/components/ui/button"
import { Message, MessageContent } from "@/components/ui/message"
import {
  MessageScroller,
  MessageScrollerButton,
  MessageScrollerContent,
  MessageScrollerItem,
  MessageScrollerProvider,
  MessageScrollerViewport,
} from "@/components/ui/message-scroller"
import { BookingCard } from "@/components/chat/booking-card"
import { SlotChips } from "@/components/chat/slot-chips"
import { Choices } from "@/components/results/choices"
import type { Dataset } from "@/lib/analysis"
import type { ChatEvent, Proposal, Slot } from "@/lib/chat/types"
import { activateScoring, scoreAll } from "@/lib/metrics"
import type { Place } from "@/lib/places"

type AssistantTurn = {
  id: string
  role: "assistant"
  query: string
  text: string
  steps: string[]
  data?: Dataset
  choices?: { text: string; options: Place[]; chosenId?: string }
  streaming: boolean
  error?: boolean
}
// A follow-up answer from the assistant (after the report): text, plus time slots or a booking card.
type ChatTurn = {
  id: string
  role: "chat"
  text: string
  slots?: Slot[]
  proposal?: Proposal
  streaming: boolean
  error?: boolean
}
type Turn = { id: string; role: "user"; text: string } | AssistantTurn | ChatTurn

const SUGGESTIONS = ["¿Por qué tengo este puntaje?", "¿Qué hago primero?", "Quiero agendar una reunión"]

type Status = "ready" | "submitted" | "streaming" | "error"

type StreamEvent =
  | { type: "status" | "text" | "error"; text: string }
  | { type: "data"; data: Dataset }
  | { type: "choices"; reason: string; text: string; options: Place[] }

const FIXTURE_DATA: Dataset = {
  mode: "business_name", queried: "Screen Door", identification: "Local elegido por el usuario en Google Maps: Screen Door Pearl District, Portland, OR",
  competitorsSource: "negocios cercanos del mismo tipo en Google Maps (radio 3 km)", generatedAt: "",
  business: { name: "Screen Door Pearl District", place: { id: "a", name: "Screen Door", address: "1131 NW Couch St, Portland", lat: 45.5236, lng: -122.6821, rating: 4.6, reviews: 1965, website: null, primaryType: null, mapsUrl: null },
    instagram: { handle: "screendoorpdx", followers: 48200, totalPosts: 900, category: null, verified: false, postsSampled: 12, avgLikes: 100, avgComments: 4, avgViews: null, engagementRatePct: 0.4, postsPerWeek: 0.6, lastPostDaysAgo: 20 }, instagramNote: "ok" },
  competitors: [
    { name: "Mother's Bistro & Bar", place: { id: "b", name: "Mothers", address: "SW 3rd", lat: 45.5207, lng: -122.679, rating: 4.6, reviews: 3120, website: null, primaryType: null, mapsUrl: null },
      instagram: { handle: "mothersbistro", followers: 21400, totalPosts: 500, category: null, verified: false, postsSampled: 12, avgLikes: 600, avgComments: 20, avgViews: null, engagementRatePct: 2.9, postsPerWeek: 3.1, lastPostDaysAgo: 1 }, instagramNote: "ok" },
    { name: "Cheryl's on 12th", place: { id: "c", name: "Cheryls", address: "SW Washington", lat: 45.512, lng: -122.684, rating: 4.5, reviews: 1480, website: null, primaryType: null, mapsUrl: null },
      instagram: { handle: "cherylson12th", followers: 9800, totalPosts: 300, category: null, verified: false, postsSampled: 12, avgLikes: 300, avgComments: 15, avgViews: null, engagementRatePct: 3.4, postsPerWeek: 5.2, lastPostDaysAgo: 1 }, instagramNote: "ok" },
  ],
}
const FIXTURE_TEXT = "## Resumen\nScreen Door queda **3.º de 3**: tiene la mayor audiencia pero casi no interactúa ni publica.\n\n## Qué sube y qué baja tu puntaje\n- **Sube:** 48 mil seguidores.\n- **Baja:** engagement de 0.4% y un post cada 20 días.\n\n## Las 3 acciones que más importan\n1. **Publica 3 veces por semana.** Los rivales lo hacen y se nota.\n2. **Pide opiniones en los pies de foto.** Tu engagement es el más bajo.\n3. **Retoma la cuenta esta semana.** Llevas 20 días sin publicar."

let counter = 0
const nextId = () => `t${++counter}`

export default function PreviewPage() {
  const [turns, setTurns] = React.useState<Turn[]>([{ id: "t900", role: "assistant", query: "Screen Door", text: FIXTURE_TEXT, steps: [], data: FIXTURE_DATA, streaming: false }])
  const [status, setStatus] = React.useState<Status>("ready")
  const [draft, setDraft] = React.useState("")
  const abortRef = React.useRef<AbortController | null>(null)

  const patch = React.useCallback((id: string, fn: (t: AssistantTurn) => Partial<AssistantTurn>) => {
    setTurns((prev) => prev.map((t) => (t.id === id && t.role === "assistant" ? { ...t, ...fn(t) } : t)))
  }, [])

  // The latest report: once it exists, the composer talks to the assistant about it.
  const report = [...turns].reverse().find((t): t is AssistantTurn => t.role === "assistant" && !!t.data)

  const patchChat = React.useCallback((id: string, fn: (t: ChatTurn) => Partial<ChatTurn>) => {
    setTurns((prev) => prev.map((t) => (t.id === id && t.role === "chat" ? { ...t, ...fn(t) } : t)))
  }, [])

  const send = (message: PromptMessage) => (report ? ask(message.text.trim()) : run(message.text.trim()))

  async function ask(text: string) {
    if (!text || !report?.data || status === "submitted" || status === "streaming") return
    setDraft("")

    // What the server needs: everything said after the report.
    const history: Array<{ role: "user" | "assistant"; content: string }> = []
    for (const t of turns.slice(turns.findIndex((x) => x.id === report.id) + 1)) {
      if (t.role === "user") history.push({ role: "user", content: t.text })
      else if (t.role === "chat" && t.text) history.push({ role: "assistant", content: t.text })
    }
    history.push({ role: "user", content: text })

    const chatId = nextId()
    setTurns((prev) => [...prev, { id: nextId(), role: "user", text }, { id: chatId, role: "chat", text: "", streaming: true }])
    setStatus("submitted")

    const controller = new AbortController()
    abortRef.current = controller
    let acc = ""
    try {
      const res = await fetch("/api/chat", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ messages: history, dataset: report.data, analysisText: report.text }),
        signal: controller.signal,
      })
      if (!res.ok || !res.body) {
        const err = await res.json().catch(() => null)
        throw new Error(err?.error ?? `Error ${res.status}`)
      }
      const reader = res.body.getReader()
      const decoder = new TextDecoder()
      let buffer = ""
      for (;;) {
        const { done, value } = await reader.read()
        if (done) break
        buffer += decoder.decode(value, { stream: true })
        const lines = buffer.split("\n")
        buffer = lines.pop() ?? ""
        for (const line of lines) {
          if (!line.trim()) continue
          const evt = JSON.parse(line) as ChatEvent
          if (evt.type === "text") {
            acc += evt.text
            setStatus("streaming")
            patchChat(chatId, () => ({ text: acc }))
          } else if (evt.type === "status") {
            if (!acc) patchChat(chatId, () => ({ text: evt.text }))
          } else if (evt.type === "slots") {
            patchChat(chatId, () => ({ slots: evt.slots }))
          } else if (evt.type === "proposal") {
            patchChat(chatId, () => ({ proposal: evt.proposal }))
          } else {
            patchChat(chatId, () => ({ text: evt.text, error: true }))
          }
        }
      }
      patchChat(chatId, () => ({ streaming: false }))
      setStatus("ready")
    } catch (e) {
      if (controller.signal.aborted) {
        patchChat(chatId, () => ({ streaming: false }))
        setStatus("ready")
        return
      }
      patchChat(chatId, () => ({ text: e instanceof Error ? e.message : "Error inesperado", streaming: false, error: true }))
      setStatus("error")
    } finally {
      abortRef.current = null
    }
  }

  async function run(query: string, pick?: { placeId: string; label: string }) {
    if (!query || status === "submitted" || status === "streaming") return
    setDraft("")

    const assistantId = nextId()
    setTurns((prev) => [
      ...prev,
      { id: nextId(), role: "user", text: pick?.label ?? query },
      { id: assistantId, role: "assistant", query, text: "", steps: ["Empezando…"], streaming: true },
    ])
    setStatus("submitted")

    const controller = new AbortController()
    abortRef.current = controller
    let acc = ""

    try {
      const res = await fetch("/api/analyze", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ query, placeId: pick?.placeId }),
        signal: controller.signal,
      })
      if (!res.ok || !res.body) {
        const err = await res.json().catch(() => null)
        throw new Error(err?.error ?? `Error ${res.status}`)
      }

      const reader = res.body.getReader()
      const decoder = new TextDecoder()
      let buffer = ""
      for (;;) {
        const { done, value } = await reader.read()
        if (done) break
        buffer += decoder.decode(value, { stream: true })
        const lines = buffer.split("\n")
        buffer = lines.pop() ?? ""
        for (const line of lines) {
          if (!line.trim()) continue
          const evt = JSON.parse(line) as StreamEvent
          if (evt.type === "status") {
            patch(assistantId, (t) => ({
              steps: t.steps[t.steps.length - 1] === evt.text ? t.steps : [...t.steps.filter((s) => s !== "Empezando…"), evt.text],
            }))
          } else if (evt.type === "data") {
            activateScoring(evt.data.scoring)
            patch(assistantId, () => ({ data: evt.data }))
          } else if (evt.type === "text") {
            acc += evt.text
            setStatus("streaming")
            patch(assistantId, () => ({ text: acc }))
          } else if (evt.type === "choices") {
            patch(assistantId, () => ({ choices: { text: evt.text, options: evt.options } }))
          } else {
            patch(assistantId, () => ({ text: evt.text, error: true }))
            setStatus("error")
          }
        }
      }
      patch(assistantId, () => ({ streaming: false }))
      setStatus((s) => (s === "error" ? "error" : "ready"))
    } catch (e) {
      if (controller.signal.aborted) {
        patch(assistantId, () => ({ streaming: false }))
        setStatus("ready")
        return
      }
      patch(assistantId, () => ({
        text: e instanceof Error ? e.message : "Error inesperado",
        streaming: false,
        error: true,
      }))
      setStatus("error")
    } finally {
      abortRef.current = null
    }
  }

  const empty = turns.length === 0
  const busy = status === "submitted" || status === "streaming"

  function pickPlace(turn: AssistantTurn, place: Place) {
    if (busy) return
    setTurns((prev) =>
      prev.map((t) =>
        t.id === turn.id && t.role === "assistant" && t.choices
          ? { ...t, choices: { ...t.choices, chosenId: place.id } }
          : t
      )
    )
    void run(turn.query, { placeId: place.id, label: `${place.name} · ${place.address}` })
  }

  const composer = (
    <PromptInput
      onSubmit={(m) => {
        void send(m)
      }}
      value={draft}
      onValueChange={setDraft}
      status={status}
      onStop={() => abortRef.current?.abort()}
    >
      <PromptInputBody>
        <PromptInputTextarea
          placeholder={report ? "Pregúntame lo que quieras sobre este análisis" : "Nombre y ciudad (Screen Door Portland) o @usuario de Instagram"}
        />
        <PromptInputActions>
          <PromptInputSubmit />
        </PromptInputActions>
      </PromptInputBody>
    </PromptInput>
  )

  return (
    <MessageScrollerProvider autoScroll>
      <main className="flex h-svh flex-col bg-background">
        <header className="flex h-14 shrink-0 items-center justify-between px-4 sm:px-6">
          <span className="font-display text-lg leading-none">Atrium</span>
          {empty ? null : (
            <Button variant="ghost" size="sm" disabled={busy} onClick={() => setTurns([])}>
              Nuevo análisis
            </Button>
          )}
        </header>

        {empty ? (
          <div className="mx-auto flex w-full max-w-2xl flex-1 flex-col items-center justify-center gap-8 px-4 pb-20 text-center sm:px-6">
            <div className="flex flex-col items-center gap-3">
              <h1 className="font-display text-4xl leading-[1.08] text-balance sm:text-5xl">
                ¿Cómo está tu negocio frente a la competencia?
              </h1>
              <p className="max-w-[52ch] text-base/relaxed text-muted-foreground text-pretty">
                Escribe el nombre con la ciudad, o su @ de Instagram, que es más preciso. Comparo su Google y sus redes sociales con los negocios de su entorno.
              </p>
            </div>
            <div className="w-full text-left">{composer}</div>
          </div>
        ) : (
          <>
            <MessageScroller className="min-h-0 flex-1">
              <MessageScrollerViewport tabIndex={-1} aria-label="Conversación">
                <MessageScrollerContent aria-busy={busy}>
                  <div className="mx-auto flex w-full max-w-4xl min-w-0 flex-col gap-8 px-4 pt-2 pb-12 sm:px-6">
                    {turns.map((turn) => (
                      <MessageScrollerItem key={turn.id} messageId={turn.id} scrollAnchor={turn.role === "user"}>
                        <div className="p-px">
                          {turn.role === "chat" ? (
                            <div className="flex max-w-[68ch] flex-col gap-5">
                              {turn.error ? (
                                <p role="alert" className="text-base/relaxed text-destructive">
                                  {turn.text}
                                </p>
                              ) : turn.text ? (
                                <Prose text={turn.text} streaming={turn.streaming} />
                              ) : !turn.slots && !turn.proposal ? (
                                <p className="flex items-center gap-2 text-sm text-muted-foreground">
                                  <IconLoader2 className="size-4 text-brand motion-safe:animate-spin" aria-hidden="true" />
                                  Pensando…
                                </p>
                              ) : null}
                              {turn.slots ? (
                                <SlotChips
                                  slots={turn.slots}
                                  disabled={busy || turns[turns.length - 1]?.id !== turn.id}
                                  onPick={(sl) => void ask(`Elijo ${sl.label}`)}
                                />
                              ) : null}
                              {turn.proposal && report?.data ? (
                                <BookingCard
                                  proposal={turn.proposal}
                                  businessName={report.data.business.name}
                                  score={scoreAll(report.data)[0].total}
                                  active={turns[turns.length - 1]?.id === turn.id}
                                  onConflict={() => void ask("Ese horario ya no está disponible, ¿qué otras opciones hay?")}
                                />
                              ) : null}
                            </div>
                          ) : turn.role === "user" ? (
                            <Message align="end">
                              <MessageContent>
                                <Bubble variant="secondary">
                                  <BubbleContent className="whitespace-pre-wrap">
                                    <span className="text-base">{turn.text}</span>
                                  </BubbleContent>
                                </Bubble>
                              </MessageContent>
                            </Message>
                          ) : (
                            <div className="flex flex-col gap-8">
                              {turn.choices ? (
                                <Choices
                                  message={turn.choices.text}
                                  options={turn.choices.options}
                                  chosenId={turn.choices.chosenId}
                                  disabled={busy}
                                  onPick={(p) => pickPlace(turn, p)}
                                />
                              ) : turn.data ? (
                                // The written analysis sits inside the report, right after the score.
                                <Report data={turn.data}>
                                  {turn.error ? (
                                    <p role="alert" className="max-w-[65ch] text-base/relaxed text-destructive">
                                      {turn.text}
                                    </p>
                                  ) : turn.text ? (
                                    <Prose text={turn.text} streaming={turn.streaming} />
                                  ) : (
                                    <p className="flex items-center gap-2 text-sm text-muted-foreground">
                                      <IconLoader2 className="size-4 text-brand motion-safe:animate-spin" aria-hidden="true" />
                                      Escribiendo el análisis…
                                    </p>
                                  )}
                                </Report>
                              ) : turn.error ? (
                                <p role="alert" className="max-w-[65ch] text-base/relaxed text-destructive">
                                  {turn.text}
                                </p>
                              ) : (
                                <Steps steps={turn.steps} working={turn.streaming} />
                              )}
                            </div>
                          )}
                        </div>
                      </MessageScrollerItem>
                    ))}
                  </div>
                </MessageScrollerContent>
              </MessageScrollerViewport>
              <MessageScrollerButton />
            </MessageScroller>
            <div className="mx-auto flex w-full max-w-4xl shrink-0 flex-col gap-3 px-4 pb-5 sm:px-6">
              {report && !busy && !turns.some((t) => t.role === "chat") ? (
                <div className="flex flex-wrap gap-2" role="group" aria-label="Preguntas sugeridas">
                  {SUGGESTIONS.map((q) => (
                    <button
                      key={q}
                      type="button"
                      onClick={() => void ask(q)}
                      className="rounded-full border bg-card px-3.5 py-1.5 text-sm transition-colors hover:bg-secondary"
                    >
                      {q}
                    </button>
                  ))}
                </div>
              ) : null}
              {composer}
            </div>
          </>
        )}
      </main>
    </MessageScrollerProvider>
  )
}
