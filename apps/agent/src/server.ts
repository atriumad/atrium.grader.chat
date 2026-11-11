import { createServer, type IncomingMessage, type Server, type ServerResponse } from "node:http"
import { authenticate } from "./auth.ts"
import type { AgentConfig } from "./config.ts"
import { PolicyError } from "./policy.ts"
import { runResearch, type RunDeps } from "./runner.ts"
import type { ResearchEvent, ResearchRequest } from "./types.ts"

const MAX_BODY_BYTES = 64 * 1024

export type ServerDeps = RunDeps & { env: Record<string, string | undefined> }

function send(res: ServerResponse, status: number, body: unknown) {
  res.writeHead(status, { "Content-Type": "application/json" })
  res.end(JSON.stringify(body))
}

async function readJson(req: IncomingMessage): Promise<unknown> {
  const chunks: Buffer[] = []
  let size = 0
  for await (const chunk of req) {
    size += (chunk as Buffer).length
    if (size > MAX_BODY_BYTES) throw new PolicyError(413, "request body too large")
    chunks.push(chunk as Buffer)
  }
  try {
    return JSON.parse(Buffer.concat(chunks).toString("utf8"))
  } catch {
    throw new PolicyError(400, "body must be valid JSON")
  }
}

// Only the fields the contract defines pass through; anything else is dropped.
function parseRequest(body: unknown): ResearchRequest {
  const b = (body ?? {}) as Record<string, unknown>
  const s = (b.subject ?? {}) as Record<string, unknown>
  const text = (v: unknown) => (typeof v === "string" && v.trim() ? v.trim().slice(0, 300) : undefined)
  if (typeof b.type !== "string") throw new PolicyError(400, "type is required")
  const subject = { placeId: text(s.placeId), name: text(s.name), city: text(s.city), instagram: text(s.instagram), clientId: text(s.clientId) }
  if (!subject.placeId && !subject.name && !subject.instagram && !subject.clientId) throw new PolicyError(400, "subject needs placeId, name, instagram or clientId")
  const options = (b.options ?? {}) as Record<string, unknown>
  return { type: b.type, subject, options: { stream: options.stream !== false, depth: options.depth === "basic" ? "basic" : "full" } }
}

export function createAgentServer(deps: ServerDeps): Server {
  const windows = new Map<string, { start: number; count: number }>()

  const overLimit = (config: AgentConfig, callerId: string): boolean => {
    const limit = config.callers.find((c) => c.id === callerId)?.rateLimit?.requestsPerMinute
    if (!limit) return false
    const t = Date.now()
    const w = windows.get(callerId)
    if (!w || t - w.start >= 60_000) {
      windows.set(callerId, { start: t, count: 1 })
      return false
    }
    return ++w.count > limit
  }

  return createServer(async (req, res) => {
    try {
      if (req.method === "GET" && req.url === "/healthz") return send(res, 200, { ok: true })
      if (req.method !== "POST" || req.url !== "/v1/research") return send(res, 404, { error: "not found" })

      const caller = authenticate(deps.config, req.headers.authorization, deps.env)
      if (!caller) return send(res, 401, { error: "invalid or missing API key" })
      if (overLimit(deps.config, caller.id)) return send(res, 429, { error: "rate limit exceeded" })

      const request = parseRequest(await readJson(req))
      const stream = request.options?.stream !== false
      // The status line is only written with the first event, so a policy error can still return its own status.
      const head = () => {
        if (!res.headersSent) res.writeHead(200, { "Content-Type": "application/x-ndjson", "Cache-Control": "no-store" })
      }
      const emit = (e: ResearchEvent) => {
        if (!stream) return
        head()
        res.write(`${JSON.stringify(e)}\n`)
      }

      try {
        const result = await runResearch(deps, caller, request, emit)
        if (stream) {
          head()
          res.end(`${JSON.stringify({ type: "result", result })}\n`)
        } else send(res, 200, result)
      } catch (e) {
        if (!(e instanceof PolicyError)) throw e
        if (res.headersSent) res.end(`${JSON.stringify({ type: "error", text: e.message })}\n`)
        else send(res, e.status, { error: e.message })
      }
    } catch (e) {
      if (e instanceof PolicyError) return send(res, e.status, { error: e.message })
      console.error("unhandled", e instanceof Error ? e.message : e)
      if (!res.headersSent) send(res, 500, { error: "internal error" })
      else res.end()
    }
  })
}
