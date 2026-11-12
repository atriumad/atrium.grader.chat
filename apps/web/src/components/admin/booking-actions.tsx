"use client"

import * as React from "react"
import { useRouter } from "next/navigation"

import { Button } from "@/components/ui/button"
import { textareaCls } from "@/components/admin/ui"
import type { BookingStatus } from "@/lib/admin/bookings"

export function BookingActions({ id, status, notes }: { id: string; status: BookingStatus; notes: string }) {
  const router = useRouter()
  const [text, setText] = React.useState(notes)
  const [busy, setBusy] = React.useState<string | null>(null)
  const [confirmCancel, setConfirmCancel] = React.useState(false)
  const [msg, setMsg] = React.useState<{ ok: boolean; text: string } | null>(null)

  async function send(body: Record<string, unknown>, key: string, ok: string) {
    setBusy(key)
    setMsg(null)
    const res = await fetch(`/api/admin/bookings/${id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(body),
    }).catch(() => null)
    const json = res ? await res.json().catch(() => ({})) : {}
    setBusy(null)
    if (res?.ok) {
      setMsg({ ok: true, text: ok })
      setConfirmCancel(false)
      router.refresh()
    } else setMsg({ ok: false, text: json.error ?? "Could not save." })
  }

  const cancelled = status === "cancelled"
  return (
    <div className="flex flex-col gap-3">
      <div>
        <label htmlFor={`notes-${id}`} className="text-xs font-medium">
          Internal notes
        </label>
        <textarea
          id={`notes-${id}`}
          className={`${textareaCls} mt-1 min-h-20`}
          value={text}
          maxLength={2000}
          onChange={(e) => setText(e.target.value)}
          placeholder="What was discussed, next steps, who follows up… Only the team sees this."
        />
        <div className="mt-1.5 flex items-center gap-2">
          <Button size="sm" variant="outline" disabled={busy !== null || text.trim() === notes.trim()} onClick={() => send({ internalNotes: text }, "notes", "Notes saved.")}>
            {busy === "notes" ? "Saving…" : "Save notes"}
          </Button>
          <span className="text-xs text-muted-foreground tnum">{text.length}/2000</span>
        </div>
      </div>

      {cancelled ? (
        <p className="text-xs text-muted-foreground">Cancelled meetings are final: the calendar event was deleted.</p>
      ) : (
        <div className="flex flex-wrap items-center gap-2">
          {status === "scheduled" ? (
            <Button size="sm" disabled={busy !== null} onClick={() => send({ status: "completed" }, "completed", "Marked as completed.")}>
              {busy === "completed" ? "Saving…" : "Mark completed"}
            </Button>
          ) : (
            <Button size="sm" variant="outline" disabled={busy !== null} onClick={() => send({ status: "scheduled" }, "scheduled", "Moved back to scheduled.")}>
              {busy === "scheduled" ? "Saving…" : "Back to scheduled"}
            </Button>
          )}
          {confirmCancel ? (
            <span className="flex flex-wrap items-center gap-2 rounded-md border border-destructive/40 px-2.5 py-1 text-xs">
              Deletes the calendar event and frees the slot. The client is not notified.
              <Button size="sm" variant="destructive" disabled={busy !== null} onClick={() => send({ status: "cancelled" }, "cancelled", "Meeting cancelled.")}>
                {busy === "cancelled" ? "Cancelling…" : "Yes, cancel it"}
              </Button>
              <Button size="sm" variant="ghost" disabled={busy !== null} onClick={() => setConfirmCancel(false)}>
                Keep
              </Button>
            </span>
          ) : (
            <Button size="sm" variant="ghost" className="text-destructive" disabled={busy !== null} onClick={() => setConfirmCancel(true)}>
              Cancel meeting
            </Button>
          )}
        </div>
      )}
      <p role="status" className={`min-h-4 text-xs ${msg?.ok === false ? "text-destructive" : "text-muted-foreground"}`}>
        {msg?.text}
      </p>
    </div>
  )
}
