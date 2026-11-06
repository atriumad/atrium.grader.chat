import Anthropic from "@anthropic-ai/sdk"

import type { Dataset } from "@/lib/analysis"
import { BookingError, availableSlots, findFreeSlot, validateInput } from "@/lib/booking"
import type { ChatEvent } from "@/lib/chat/types"
import { chatSystemPrompt } from "@/lib/chat/prompt"
import { chatTools } from "@/lib/chat/tools"
import { scoreAll } from "@/lib/metrics"
import { allow, clientKey } from "@/lib/rate-limit"

export const maxDuration = 120

const MAX_TOOL_ROUNDS = 5

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
    return Response.json({ error: "Demasiados mensajes seguidos. Espera unos minutos." }, { status: 429 })
  }
  const body = (await req.json().catch(() => null)) as { messages?: unknown; dataset?: unknown; analysisText?: unknown } | null
  const messages = parseMessages(body?.messages)
  const data = parseDataset(body?.dataset)
  if (!messages || !data) return Response.json({ error: "Solicitud no válida." }, { status: 400 })
  const analysisText = typeof body?.analysisText === "string" ? body.analysisText : ""

  const apiKey = process.env.ANTHROPIC_API_KEY
  if (!apiKey) return Response.json({ error: "Falta ANTHROPIC_API_KEY: el chat necesita la API de Claude." }, { status: 503 })

  const businessScore = scoreAll(data)[0].total
  const client = new Anthropic({ apiKey })
  const system = chatSystemPrompt(data, analysisText)
  const encoder = new TextEncoder()

  const stream = new ReadableStream({
    async start(controller) {
      const send = (e: Event) => controller.enqueue(encoder.encode(JSON.stringify(e) + "\n"))

      // Runs one tool. Nothing here books anything: propose_booking only shows a card.
      const runTool = async (name: string, input: Record<string, unknown>): Promise<{ content: string; is_error?: boolean }> => {
        try {
          if (name === "get_availability") {
            const part = input.part_of_day === "morning" || input.part_of_day === "afternoon" ? input.part_of_day : "any"
            const days = Number.isInteger(input.days_ahead) ? Math.min(14, Math.max(1, input.days_ahead as number)) : 14
            const slots = await availableSlots({ partOfDay: part, daysAhead: days })
            if (!slots.length) return { content: "No hay horarios libres con ese criterio. Prueba otro día o franja." }
            send({ type: "slots", slots })
            return {
              content:
                `Se mostraron ${slots.length} horarios al usuario como botones. Zona horaria de la agencia. Horarios (usa 'start' tal cual en propose_booking):\n` +
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
            if (!v.ok) return { content: `Datos no válidos: ${v.error} Pídeselos de nuevo al usuario.`, is_error: true }
            const slot = await findFreeSlot(v.value.start)
            if (!slot) return { content: "Ese horario ya no está disponible. Consulta disponibilidad otra vez y ofrece otros.", is_error: true }
            send({
              type: "proposal",
              proposal: { start: slot.start, label: slot.label, name: v.value.name, email: v.value.email, phone: v.value.phone, notes: v.value.notes },
            })
            return {
              content:
                "Tarjeta mostrada al usuario. La reunión NO está agendada: falta que él pulse Confirmar. Dile que revise los datos y confirme; no digas que ya está reservada.",
            }
          }
          return { content: `Herramienta desconocida: ${name}`, is_error: true }
        } catch (e) {
          if (e instanceof BookingError) {
            const msg = e.code === "not_configured" ? "La agenda no está configurada en el servidor todavía." : e.message
            return { content: msg, is_error: true }
          }
          return { content: "La herramienta falló. Discúlpate con el usuario sin inventar otra forma de contacto.", is_error: true }
        }
      }

      try {
        const convo: Anthropic.MessageParam[] = messages.map((m) => ({ role: m.role, content: m.content }))
        for (let round = 0; round < MAX_TOOL_ROUNDS; round++) {
          const s = client.messages.stream({
            model: process.env.ANTHROPIC_MODEL ?? "claude-sonnet-5-5",
            max_tokens: 1200,
            system,
            tools: chatTools,
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
        send({ type: "error", text: "El asistente dio demasiadas vueltas. Intenta de nuevo." })
      } catch (e) {
        send({ type: "error", text: e instanceof Error ? e.message : "Error inesperado" })
      } finally {
        controller.close()
      }
    },
  })

  return new Response(stream, {
    headers: { "Content-Type": "application/x-ndjson; charset=utf-8", "Cache-Control": "no-store" },
  })
}
