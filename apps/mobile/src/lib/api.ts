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

// POST JSON to the web server. Throws friendly Spanish errors for network and HTTP failures.
export async function postJson(path: string, body: unknown, signal?: AbortSignal) {
  if (!API_URL) {
    throw new Error("Falta EXPO_PUBLIC_API_URL. Copia .env.example a .env y reinicia Expo.")
  }
  try {
    return await fetch(`${API_URL}${path}`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(body),
      signal,
    })
  } catch (e) {
    if (signal?.aborted) throw e
    throw new Error(
      `No pude conectar con el servidor (${API_URL}). Comprueba que la web app esté corriendo y que el teléfono esté en la misma wifi.`
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
