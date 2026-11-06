import { BookingError, createBooking } from "@/lib/booking"
import { allow, clientKey } from "@/lib/rate-limit"

// Creates the meeting. Only called when the user presses Confirm on the proposal card.
export async function POST(req: Request) {
  if (!allow(`book:${clientKey(req)}`, 10, 10 * 60_000)) {
    return Response.json({ error: "Demasiados intentos. Espera unos minutos." }, { status: 429 })
  }
  const b = (await req.json().catch(() => null)) as Record<string, unknown> | null
  if (!b || typeof b.start !== "string") return Response.json({ error: "Solicitud no válida." }, { status: 400 })

  try {
    const r = await createBooking({
      start: b.start,
      name: String(b.name ?? ""),
      email: String(b.email ?? ""),
      phone: typeof b.phone === "string" ? b.phone : "",
      notes: typeof b.notes === "string" ? b.notes : "",
      businessName: String(b.businessName ?? ""),
      score: typeof b.score === "number" ? b.score : null,
    })
    return Response.json({ ok: true, label: r.label, mock: r.mock, meetLink: r.meetLink ?? null })
  } catch (e) {
    if (e instanceof BookingError) {
      const status = { invalid: 400, unavailable: 409, not_configured: 503, provider_error: 502 }[e.code]
      return Response.json({ error: e.message, code: e.code }, { status })
    }
    return Response.json({ error: "No pude crear la reunión." }, { status: 500 })
  }
}
