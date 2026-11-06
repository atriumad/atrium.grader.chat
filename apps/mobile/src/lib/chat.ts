// Follow-up chat and booking. Types copied from the web app (src/lib/chat/types.ts).
import { httpError, postJson } from "./api"
import { readNdjson } from "./ndjson"
import type { Dataset } from "./types"

export type Slot = { start: string; end: string; label: string }
export type Proposal = { start: string; label: string; name: string; email: string; phone: string; notes: string }
export type ChatEvent =
  | { type: "text"; text: string }
  | { type: "slots"; slots: Slot[] }
  | { type: "proposal"; proposal: Proposal }
  | { type: "error"; text: string }

export type ChatMessage = { role: "user" | "assistant"; content: string }

export async function* chat(
  body: { messages: ChatMessage[]; dataset: Dataset; analysisText: string },
  signal?: AbortSignal
): AsyncGenerator<ChatEvent> {
  const res = await postJson("/api/chat", body, signal)
  if (!res.ok || !res.body) throw new Error(await httpError(res))
  yield* readNdjson<ChatEvent>(res.body as ReadableStream<Uint8Array>)
}

export type BookResult =
  | { ok: true; label: string; mock: boolean; meetLink: string | null }
  | { ok: false; message: string; conflict: boolean }

// The only call that creates a meeting; the app makes it when the user taps Confirm.
export async function book(payload: {
  start: string
  name: string
  email: string
  phone: string
  notes: string
  businessName: string
  score: number | null
}): Promise<BookResult> {
  try {
    const res = await postJson("/api/book", payload)
    const json = await res.json().catch(() => ({}))
    if (!res.ok) return { ok: false, message: json?.error ?? `Error ${res.status}`, conflict: res.status === 409 }
    return { ok: true, label: json.label, mock: !!json.mock, meetLink: json.meetLink ?? null }
  } catch (e) {
    return { ok: false, message: e instanceof Error ? e.message : "No pude conectar con el servidor.", conflict: false }
  }
}
