import { fetch } from "expo/fetch"

import { readNdjson } from "./ndjson"
import type { Dataset, Place } from "./types"

export type { Place } from "./types"

export const API_URL = (process.env.EXPO_PUBLIC_API_URL ?? "").replace(/\/$/, "")

// Events streamed by the web server's /api/analyze route.
export type StreamEvent =
  | { type: "status" | "text" | "error"; text: string }
  | { type: "data"; data: Dataset }
  | { type: "choices"; reason: "multiple" | "confirm" | "typo"; text: string; options: Place[] }

// POST JSON to the web server. Throws friendly errors for network and HTTP failures.
export async function postJson(path: string, body: unknown, signal?: AbortSignal) {
  if (!API_URL) {
    throw new Error("EXPO_PUBLIC_API_URL is missing. Copy .env.example to .env and restart Expo.")
  }
  try {
    return await fetch(`${API_URL}${path}`, {
      method: "POST",
      headers: { "Content-Type": "application/json", "x-atrium-source": "mobile" },
      body: JSON.stringify(body),
      signal,
    })
  } catch (e) {
    if (signal?.aborted) throw e
    throw new Error(
      `I could not reach the server (${API_URL}). Check that the web app is running and that the phone is on the same Wi-Fi.`
    )
  }
}

export async function httpError(res: { status: number; json: () => Promise<any> }) {
  try {
    return (await res.json())?.error ?? `Error ${res.status}`
  } catch {
    return `Error ${res.status}`
  }
}

export async function* analyze(
  query: string,
  opts: { placeId?: string; signal?: AbortSignal } = {}
): AsyncGenerator<StreamEvent> {
  const res = await postJson("/api/analyze", { query, placeId: opts.placeId }, opts.signal)
  if (!res.ok || !res.body) throw new Error(await httpError(res))
  yield* readNdjson<StreamEvent>(res.body as ReadableStream<Uint8Array>)
}
