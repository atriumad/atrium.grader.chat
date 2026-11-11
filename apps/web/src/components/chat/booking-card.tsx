"use client"

import * as React from "react"
import { IconCircleCheckFilled, IconLoader2 } from "@tabler/icons-react"

import type { Proposal } from "@/lib/chat/types"

type State = { kind: "idle" } | { kind: "saving" } | { kind: "done"; label: string; mock: boolean; meetLink: string | null } | { kind: "error"; message: string; conflict: boolean }

// The only place a meeting is created: nothing is booked until the user presses Confirm.
export function BookingCard({
  proposal,
  businessName,
  score,
  active,
  onConflict,
}: {
  proposal: Proposal
  businessName: string
  score: number | null
  active: boolean // false once the conversation has moved on
  onConflict: () => void
}) {
  const [name, setName] = React.useState(proposal.name)
  const [email, setEmail] = React.useState(proposal.email)
  const [phone, setPhone] = React.useState(proposal.phone)
  const [state, setState] = React.useState<State>({ kind: "idle" })

  async function confirm() {
    setState({ kind: "saving" })
    try {
      const res = await fetch("/api/book", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ start: proposal.start, name, email, phone, notes: proposal.notes, businessName, score }),
      })
      const json = await res.json().catch(() => ({}))
      if (!res.ok) {
        setState({ kind: "error", message: json?.error ?? `Error ${res.status}`, conflict: res.status === 409 })
        return
      }
      setState({ kind: "done", label: json.label, mock: !!json.mock, meetLink: json.meetLink ?? null })
    } catch {
      setState({ kind: "error", message: "I could not reach the server. Please try again.", conflict: false })
    }
  }

  if (state.kind === "done") {
    return (
      <div className="report-rise flex max-w-[68ch] items-start gap-3 rounded-2xl border bg-card p-4" role="status">
        <IconCircleCheckFilled className="mt-0.5 size-5 shrink-0 text-positive" aria-hidden="true" />
        <div className="flex flex-col gap-1">
          <p className="font-medium">Meeting booked</p>
          <p className="text-sm">{state.label}</p>
          {state.mock ? (
            <p className="text-sm text-muted-foreground">Test mode: no real event was created and no invitation was sent.</p>
          ) : (
            <p className="text-sm text-muted-foreground">An invitation will be sent to {email}.</p>
          )}
          {state.meetLink ? (
            <a href={state.meetLink} className="text-sm underline underline-offset-4" target="_blank" rel="noreferrer">
              Enlace de la videollamada
            </a>
          ) : null}
        </div>
      </div>
    )
  }

  const busy = state.kind === "saving"
  const field = "h-10 w-full rounded-lg border bg-background px-3 text-sm outline-none focus-visible:ring-2 focus-visible:ring-brand disabled:opacity-60"
  return (
    <form
      className="report-rise flex max-w-[68ch] flex-col gap-4 rounded-2xl border bg-card p-4 sm:p-5"
      onSubmit={(e) => {
        e.preventDefault()
        if (active && !busy) void confirm()
      }}
    >
      <div className="flex flex-col gap-0.5">
        <p className="font-display text-xl leading-snug">Review and confirm your meeting</p>
        <p className="text-sm text-muted-foreground tnum">{proposal.label}</p>
      </div>
      <div className="grid gap-3 sm:grid-cols-2">
        <label className="flex flex-col gap-1 text-sm">
          Name
          <input className={field} value={name} onChange={(e) => setName(e.target.value)} disabled={!active || busy} autoComplete="name" required />
        </label>
        <label className="flex flex-col gap-1 text-sm">
          Email
          <input className={field} type="email" value={email} onChange={(e) => setEmail(e.target.value)} disabled={!active || busy} autoComplete="email" required />
        </label>
        <label className="flex flex-col gap-1 text-sm sm:col-span-2">
          Phone <span className="text-muted-foreground">(optional)</span>
          <input className={field} type="tel" value={phone} onChange={(e) => setPhone(e.target.value)} disabled={!active || busy} autoComplete="tel" />
        </label>
      </div>
      {proposal.notes ? <p className="text-sm text-muted-foreground text-pretty">Topic: {proposal.notes}</p> : null}
      <p className="text-xs text-muted-foreground text-pretty">
        By confirming you share your name, email and phone with the Atrium team only to schedule and handle this meeting.
      </p>
      {state.kind === "error" ? (
        <div role="alert" className="flex flex-col gap-2 text-sm text-destructive">
          <p>{state.message}</p>
          {state.conflict ? (
            <button type="button" onClick={onConflict} className="w-fit rounded-full border bg-card px-3 py-1 text-foreground transition-colors hover:bg-secondary">
              Ver otros horarios
            </button>
          ) : null}
        </div>
      ) : null}
      <button
        type="submit"
        disabled={!active || busy}
        className="inline-flex h-11 items-center justify-center gap-2 rounded-full bg-foreground px-6 text-sm font-medium text-primary-foreground transition-opacity enabled:hover:opacity-90 disabled:opacity-50 sm:w-fit"
      >
        {busy ? <IconLoader2 className="size-4 motion-safe:animate-spin" aria-hidden="true" /> : null}
        {busy ? "Booking…" : "Confirm meeting"}
      </button>
    </form>
  )
}
