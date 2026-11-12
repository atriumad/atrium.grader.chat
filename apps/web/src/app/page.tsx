"use client"

import * as React from "react"
import { IconLoader2, IconMessageCircle } from "@tabler/icons-react"

import {
  PromptInput,
  PromptInputActions,
  PromptInputBody,
  PromptInputSubmit,
  PromptInputTextarea,
} from "@/components/blocks/prompt-input/prompt-input"
import { Prose } from "@/components/results/prose"
import { Report } from "@/components/results/report"
import { Scan, type ScanStep } from "@/components/results/scan"
import { HomeContent } from "@/components/seo/home-content"
import { HomeJsonLd } from "@/components/seo/json-ld"
import { Bubble, BubbleContent } from "@/components/ui/bubble"
import { Button } from "@/components/ui/button"
import { Sheet, SheetBody, SheetContent, SheetFooter, SheetHeader, SheetTitle } from "@/components/ui/sheet"
import { Message, MessageContent } from "@/components/ui/message"
import { BookingCard } from "@/components/chat/booking-card"
import { SlotChips } from "@/components/chat/slot-chips"
import { Choices } from "@/components/results/choices"
import { SearchForm } from "@/components/results/search-form"
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
  scan: ScanStep[]
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

const SUGGESTIONS = ["Why is my score what it is?", "What should I do first?", "I want to book a meeting"]

type Status = "ready" | "submitted" | "streaming" | "error"

type StreamEvent =
  | { type: "status" | "text" | "error"; text: string }
  | { type: "data"; data: Dataset }
  | ({ type: "step" } & ScanStep)
  | { type: "choices"; reason: string; text: string; options: Place[] }

let counter = 0
const nextId = () => `t${++counter}`

export default function Page() {
  const [turns, setTurns] = React.useState<Turn[]>([])
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

  async function ask(text: string) {
    if (!text || !report?.data || status === "submitted" || status === "streaming") return
    setDraft("")
    setChatOpen(true)

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
      patchChat(chatId, () => ({ text: e instanceof Error ? e.message : "Unexpected error", streaming: false, error: true }))
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
      { id: assistantId, role: "assistant", query, text: "", steps: ["Starting…"], scan: [], streaming: true },
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
          if (evt.type === "step") {
            const { id, label, state, meta } = evt
            patch(assistantId, (t) => ({
              scan: t.scan.some((x) => x.id === id)
                ? t.scan.map((x) => (x.id === id ? { id, label, state, meta } : x))
                : [...t.scan, { id, label, state, meta }],
            }))
          } else if (evt.type === "status") {
            patch(assistantId, (t) => ({
              steps: t.steps[t.steps.length - 1] === evt.text ? t.steps : [...t.steps.filter((s) => s !== "Starting…"), evt.text],
            }))
          } else if (evt.type === "data") {
            activateScoring(evt.data.scoring) // rules published in the admin panel
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
        text: e instanceof Error ? e.message : "Unexpected error",
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

  // Once the report exists the page is a dashboard: the report is the whole main view, and the
  // questions asked about it live in a side sheet.
  const reportIndex = report ? turns.findIndex((t) => t.id === report.id) : -1
  const chatTurns = report ? turns.slice(reportIndex + 1) : []
  const [chatOpen, setChatOpen] = React.useState(false)
  const chatEndRef = React.useRef<HTMLDivElement | null>(null)
  const lastChat = chatTurns[chatTurns.length - 1]
  const lastChatText = lastChat?.role === "chat" ? lastChat.text : ""
  React.useEffect(() => {
    if (chatOpen) chatEndRef.current?.scrollIntoView({ block: "end" })
  }, [chatOpen, chatTurns.length, lastChatText])
  // What is on screen before there is a report: the scan, the "which one is yours" choices or an error.
  const working = [...turns].reverse().find((t): t is AssistantTurn => t.role === "assistant")
  const questions = chatTurns.filter((t) => t.role === "user").length

  function reset() {
    setTurns([])
    setChatOpen(false)
    setDraft("")
    setStatus("ready")
  }

  const turnBody = (turn: Turn) => (
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
              onPick={(sl) => void ask(`I pick ${sl.label}`)}
            />
          ) : null}
          {turn.proposal && report?.data ? (
            <BookingCard
              proposal={turn.proposal}
              businessName={report.data.business.name}
              score={scoreAll(report.data)[0].total}
              active={turns[turns.length - 1]?.id === turn.id}
              onConflict={() => void ask("That time slot is no longer available. What other options are there?")}
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
            // The written analysis sits inside the dashboard, next to the signals.
            <Report data={turn.data} onAsk={(q) => void ask(q)}>
              {turn.error ? (
                <p role="alert" className="max-w-[65ch] text-base/relaxed text-destructive">
                  {turn.text}
                </p>
              ) : turn.text ? (
                <Prose text={turn.text} streaming={turn.streaming} />
              ) : (
                <p className="flex items-center gap-2 text-sm text-muted-foreground">
                  <IconLoader2 className="size-4 text-brand motion-safe:animate-spin" aria-hidden="true" />
                  Writing the analysis…
                </p>
              )}
            </Report>
          ) : turn.error ? (
            <p role="alert" className="max-w-[65ch] text-base/relaxed text-destructive">
              {turn.text}
            </p>
          ) : (
            <Scan steps={turn.scan} name={turn.query} />
          )}
        </div>
      )}
    </div>
  )

  // The composer lives only in the side sheet: it talks to the assistant about the report.
  const composer = (
    <PromptInput
      onSubmit={(m) => {
        void ask(m.text.trim())
      }}
      value={draft}
      onValueChange={setDraft}
      status={status}
      onStop={() => abortRef.current?.abort()}
    >
      <PromptInputBody>
        <PromptInputTextarea placeholder="Ask about this analysis" />
        <PromptInputActions>
          <PromptInputSubmit />
        </PromptInputActions>
      </PromptInputBody>
    </PromptInput>
  )

  return (
    <main className="flex min-h-svh flex-col bg-background">
      <header className="sticky top-0 z-20 shrink-0 border-b bg-background/90 backdrop-blur">
      <div className="mx-auto flex h-14 w-full max-w-[1400px] items-center justify-between px-4 sm:px-6">
        <span className="font-display text-lg leading-none">Atrium</span>
        {empty ? null : (
          <div className="flex items-center gap-2">
            {report ? (
              <Button variant="outline" size="sm" onClick={() => setChatOpen(true)}>
                <IconMessageCircle aria-hidden="true" />
                Ask{questions > 0 ? ` (${questions})` : ""}
              </Button>
            ) : null}
            <Button variant="ghost" size="sm" disabled={busy} onClick={reset}>
              New analysis
            </Button>
          </div>
        )}
      </div>
      </header>

      {empty ? (
        <>
        <HomeJsonLd />
        <div className="mx-auto flex min-h-[70svh] w-full max-w-2xl flex-col items-center justify-center gap-8 px-4 pb-20 text-center sm:px-6">
          <div className="flex flex-col items-center gap-3">
            <h1 className="font-display text-4xl leading-[1.08] text-balance sm:text-5xl">
              How does your business stack up against the competition?
            </h1>
            <p className="max-w-[52ch] text-base/relaxed text-muted-foreground text-pretty">
              Type your business name and pick it from the list. I compare its Google and social media presence with the businesses around it.
            </p>
          </div>
          <div className="w-full text-left">
            <SearchForm
              value={draft}
              onValueChange={setDraft}
              onSubmit={(q) => void run(q)}
              onPick={(p) => void run(p.name, { placeId: p.placeId, label: `${p.name} · ${p.detail}` })}
              disabled={busy}
            />
          </div>
        </div>
        <HomeContent />
        </>
      ) : report ? (
        <div className="mx-auto w-full max-w-[1400px] flex-1 px-4 pt-6 pb-16 sm:px-6" aria-busy={busy}>
          {turnBody(report)}
        </div>
      ) : (
        <div className="mx-auto flex w-full max-w-3xl flex-1 flex-col gap-6 px-4 py-8 sm:px-6" aria-busy={busy}>
          {working ? turnBody(working) : null}
          {working?.error && !busy ? (
            <Button variant="outline" className="w-fit" onClick={reset}>
              Probar de nuevo
            </Button>
          ) : null}
        </div>
      )}

      <Sheet open={chatOpen && !!report} onOpenChange={setChatOpen}>
        <SheetContent side="right" className="sm:max-w-lg">
          <SheetHeader>
            <SheetTitle>Ask about this analysis</SheetTitle>
          </SheetHeader>
          <SheetBody>
            <div className="flex flex-col gap-6 py-4" aria-live="polite">
              {chatTurns.length === 0 && !busy ? (
                <div className="flex flex-wrap gap-2" role="group" aria-label="Suggested questions">
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
              {chatTurns.map((turn) => (
                <div key={turn.id}>{turnBody(turn)}</div>
              ))}
              <div ref={chatEndRef} />
            </div>
          </SheetBody>
          <SheetFooter className="sm:flex-col">{composer}</SheetFooter>
        </SheetContent>
      </Sheet>
    </main>
  )
}
