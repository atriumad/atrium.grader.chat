"use client"

import * as React from "react"

import { Button } from "@/components/ui/button"
import { inputCls } from "@/components/admin/ui"

export function LoginForm() {
  const [email, setEmail] = React.useState("")
  const [state, setState] = React.useState<"idle" | "sending" | "sent" | "error">("idle")
  const [msg, setMsg] = React.useState("")

  async function submit(e: React.FormEvent) {
    e.preventDefault()
    setState("sending")
    const res = await fetch("/api/admin/login", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ email }),
    }).catch(() => null)
    const json = res ? await res.json().catch(() => ({})) : {}
    if (res?.ok) setState("sent")
    else {
      setMsg(json.error ?? "Could not send. Try again.")
      setState("error")
    }
  }

  if (state === "sent")
    return (
      <p role="status" className="rounded-2xl border bg-card p-4 text-sm text-pretty">
        If the email is authorized, you will receive a link in a few seconds. Check your spam folder too.
      </p>
    )
  return (
    <form onSubmit={submit} className="flex flex-col gap-3">
      <label className="flex flex-col gap-1.5 text-sm">
        Correo
        <input type="email" required autoFocus autoComplete="email" value={email} onChange={(e) => setEmail(e.target.value)} className={inputCls} />
      </label>
      {state === "error" ? <p role="alert" className="text-sm text-destructive">{msg}</p> : null}
      <Button type="submit" disabled={state === "sending" || !email}>
        {state === "sending" ? "Sending…" : "Send link"}
      </Button>
    </form>
  )
}
