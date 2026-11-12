import { BookingError, createBooking } from "@/lib/booking"
import { logEvent } from "@/lib/admin/log"
import { allow, clientKey } from "@/lib/rate-limit"

// Creates the meeting. Only called when the user presses Confirm on the proposal card.
export async function POST(req: Request) {
  if (!allow(`book:${clientKey(req)}`, 10, 10 * 60_000)) {
    return Response.json({ error: "Too many attempts. Wait a few minutes." }, { status: 429 })
  }
  const b = (await req.json().catch(() => null)) as Record<string, unknown> | null
  if (!b || typeof b.start !== "string") return Response.json({ error: "Invalid request." }, { status: 400 })
  // The invitation goes out from the agency's calendar to whatever address was typed, so one
  // address (and the whole endpoint) can only be used a few times: it must not become a mail relay.
  const email = String(b.email ?? "").trim().toLowerCase().slice(0, 120)
  if (!allow(`book-email:${email}`, 2, 24 * 3_600_000) || !allow("book-all", 40, 3_600_000)) {
    return Response.json({ error: "Too many attempts. Wait a few minutes." }, { status: 429 })
  }

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
    logEvent("booking", { mock: r.mock, email_visitor: r.emails?.visitor ?? null, email_ops: r.emails?.ops ?? null, email_error: r.emails?.error ?? null })
    return Response.json({ ok: true, label: r.label, mock: r.mock, meetLink: r.meetLink ?? null })
  } catch (e) {
    if (e instanceof BookingError) {
      const status = { invalid: 400, unavailable: 409, not_configured: 503, provider_error: 502 }[e.code]
      return Response.json({ error: e.message, code: e.code }, { status })
    }
    return Response.json({ error: "I could not create the meeting." }, { status: 500 })
  }
}
