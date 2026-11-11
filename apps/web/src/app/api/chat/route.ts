import Anthropic from "@anthropic-ai/sdk"

import type { Dataset } from "@/lib/analysis"
import { BookingError, availableSlots, findFreeSlot, validateInput } from "@/lib/booking"
import type { ChatEvent } from "@/lib/chat/types"
import { chatSystemPrompt } from "@/lib/chat/prompt"
import { liveGoogle, liveSocial, searchRanking, seoAudit } from "@/lib/chat/research"
import { chatToolsFor, toolEnabled } from "@/lib/chat/tools"
import { getAgent, getScoring } from "@/lib/admin/config"
import { logEvent } from "@/lib/admin/log"
import { pinnedKnowledge, searchKnowledge } from "@/lib/admin/knowledge"
import { activateScoring, scoreAll } from "@/lib/metrics"
import { allow, clientKey } from "@/lib/rate-limit"

export const maxDuration = 120

const STATUS: Record<string, string> = {
  get_live_social_stats: "Checking social networks…",
  get_live_google_reputation: "Consultando Google Maps…",
  audit_website_seo: "Checking the website…",
  check_google_ranking: "Searching Google…",
}

type Event = ChatEvent

type Msg = { role: "user" | "assistant"; content: string }

function parseDataset(x: unknown): Dataset | null {
  try {
    if (!x || typeof x !== "object" || JSON.stringify(x).length > 80_000) return null
    const d = x as Dataset
    if (typeof d.business?.name !== "string" || !Array.isArray(d.competitors) || d.competitors.length > 12) return null
    if (typeof d.identification !== "string" || typeof d.competitorsSource !== "string") return null
    scoreAll(d) // throws if the shape is wrong
    return d
  } catch {
    return null
  }
}

function parseMessages(x: unknown): Msg[] | null {
  if (!Array.isArray(x) || x.length < 1 || x.length > 30) return null
  const out: Msg[] = []
  for (const m of x) {
    if ((m?.role !== "user" && m?.role !== "assistant") || typeof m.content !== "string") return null
    const content = m.content.trim().slice(0, 2000)
    if (content) out.push({ role: m.role, content })
  }
  return out.length && out[out.length - 1].role === "user" ? out : null
}

export async function POST(req: Request) {
  if (!allow(`chat:${clientKey(req)}`, 40, 10 * 60_000)) {
    return Response.json({ error: "Too many messages in a row. Wait a few minutes." }, { status: 429 })
  }
  const body = (await req.json().catch(() => null)) as { messages?: unknown; dataset?: unknown; analysisText?: unknown } | null
  const messages = parseMessages(body?.messages)
  // Score with the rules the user's analysis was made with; else the published ones.
  const [scoring, agent, pinned] = await Promise.all([getScoring(), getAgent(), pinnedKnowledge()])
  const ds = body?.dataset as { scoring?: unknown } | null | undefined
  activateScoring(ds && typeof ds === "object" && ds.scoring ? ds.scoring : scoring.config)
  const data = parseDataset(body?.dataset)
  if (!messages || !data) return Response.json({ error: "Invalid request." }, { status: 400 })
  const analysisText = typeof body?.analysisText === "string" ? body.analysisText : ""

  const apiKey = process.env.ANTHROPIC_API_KEY
  if (!apiKey) return Response.json({ error: "ANTHROPIC_API_KEY is missing: the chat needs the Claude API." }, { status: 503 })

  const businessScore = scoreAll(data)[0].total
  const client = new Anthropic({ apiKey })
  const system = chatSystemPrompt(data, analysisText, { config: agent.config, pinned })
  const tools = chatToolsFor(agent.config.tools)
  logEvent("chat_message", { business: data.business.name.slice(0, 120) })
  const encoder = new TextEncoder()

  const stream = new ReadableStream({
    async start(controller) {
      const send = (e: Event) => controller.enqueue(encoder.encode(JSON.stringify(e) + "\n"))

      // Runs one tool. Nothing here books anything: propose_booking only shows a card.
      const runTool = async (name: string, input: Record<string, unknown>): Promise<{ content: string; is_error?: boolean }> => {
        if (!toolEnabled(name, agent.config.tools)) return { content: "That tool is not available.", is_error: true }
        logEvent("tool_call", { tool: name })
        try {
          if (name === "search_agency_knowledge") {
            const q = String(input.query ?? "").trim()
            if (q.length < 2) return { content: "Empty query.", is_error: true }
            send({ type: "status", text: "Searching the agency's material…" })
            const hits = await searchKnowledge(q, 4)
            if (!hits.length) return { content: "There is no agency material on that topic. Do not invent anything: say so clearly." }
            return { content: JSON.stringify(hits.map((h) => ({ documento: h.title, texto: h.content }))).slice(0, 8000) }
          }
          if (name === "get_availability") {
            const part = input.part_of_day === "morning" || input.part_of_day === "afternoon" ? input.part_of_day : "any"
            const days = Number.isInteger(input.days_ahead) ? Math.min(14, Math.max(1, input.days_ahead as number)) : 14
            const slots = await availableSlots({ partOfDay: part, daysAhead: days })
            if (!slots.length) return { content: "There are no free slots for that criterion. Try another day or time range." }
            send({ type: "slots", slots })
            return {
              content:
                `${slots.length} time slots were shown to the user as buttons. Times are in the agency's time zone. Slots (use 'start' exactly as given in propose_booking):\n` +
                JSON.stringify(slots.map((s) => ({ start: s.start, label: s.label }))),
            }
          }
          if (name === "propose_booking") {
            const v = validateInput({
              start: String(input.slot_start ?? ""),
              name: String(input.name ?? ""),
              email: String(input.email ?? ""),
              phone: typeof input.phone === "string" ? input.phone : "",
              notes: typeof input.notes === "string" ? input.notes : "",
              businessName: data.business.name,
              score: businessScore,
            })
            if (!v.ok) return { content: `Invalid details: ${v.error} Ask the user for them again.`, is_error: true }
            const slot = await findFreeSlot(v.value.start)
            if (!slot) return { content: "That time slot is no longer available. Check availability again and offer others.", is_error: true }
            send({
              type: "proposal",
              proposal: { start: slot.start, label: slot.label, name: v.value.name, email: v.value.email, phone: v.value.phone, notes: v.value.notes },
            })
            return {
              content:
                "Card shown to the user. The meeting is NOT booked: they still have to press Confirm. Tell them to review the details and confirm; do not say it is already booked.",
            }
          }
          if (name === "get_live_social_stats" || name === "get_live_google_reputation" || name === "audit_website_seo" || name === "check_google_ranking") {
            const run = { get_live_social_stats: liveSocial, get_live_google_reputation: liveGoogle, audit_website_seo: seoAudit, check_google_ranking: searchRanking }[name]
            send({ type: "status", text: STATUS[name] })
            return { content: JSON.stringify(await run(data, input)).slice(0, 12_000) }
          }
          return { content: `Herramienta desconocida: ${name}`, is_error: true }
        } catch (e) {
          if (name !== "get_availability" && name !== "propose_booking") {
            logEvent("tool_error", { tool: name, error: e instanceof Error ? e.message.slice(0, 160) : "error" })
            return { content: `The lookup failed: ${e instanceof Error ? e.message : "error"}. Say so clearly and use the diagnosis data.`, is_error: true }
          }
          if (e instanceof BookingError) {
            const msg = e.code === "not_configured" ? "The calendar is not configured on the server yet." : e.message
            return { content: msg, is_error: true }
          }
          return { content: "The tool failed. Apologize to the user without inventing another way to get in touch.", is_error: true }
        }
      }

      try {
        const convo: Anthropic.MessageParam[] = messages.map((m) => ({ role: m.role, content: m.content }))
        for (let round = 0; round < agent.config.maxToolRounds; round++) {
          const s = client.messages.stream({
            model: process.env.ANTHROPIC_MODEL ?? "claude-sonnet-5-5",
            max_tokens: 1200,
            system,
            tools: tools.length ? tools : undefined,
            messages: convo,
          })
          for await (const event of s) {
            if (event.type === "content_block_delta" && event.delta.type === "text_delta") send({ type: "text", text: event.delta.text })
          }
          const final = await s.finalMessage()
          if (final.stop_reason !== "tool_use") return
          convo.push({ role: "assistant", content: final.content })
          const results: Anthropic.ToolResultBlockParam[] = []
          for (const block of final.content) {
            if (block.type !== "tool_use") continue
            const r = await runTool(block.name, (block.input ?? {}) as Record<string, unknown>)
            results.push({ type: "tool_result", tool_use_id: block.id, content: r.content, is_error: r.is_error })
          }
          convo.push({ role: "user", content: results })
        }
        send({ type: "error", text: "The assistant took too many steps. Try again." })
      } catch (e) {
        send({ type: "error", text: e instanceof Error ? e.message : "Unexpected error" })
      } finally {
        controller.close()
      }
    },
  })

  return new Response(stream, {
    headers: { "Content-Type": "application/x-ndjson; charset=utf-8", "Cache-Control": "no-store" },
  })
}
