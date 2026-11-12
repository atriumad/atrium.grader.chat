import { parsePatch, updateBooking } from "@/lib/admin/bookings"
import { logEvent } from "@/lib/admin/log"
import { requireAdmin } from "@/lib/supabase/auth"

type Ctx = { params: Promise<{ id: string }> }
const UUID = /^[0-9a-f-]{36}$/i

export async function PATCH(req: Request, ctx: Ctx) {
  const a = await requireAdmin()
  if ("error" in a) return a.error
  const { id } = await ctx.params
  if (!UUID.test(id)) return Response.json({ error: "Meeting not found." }, { status: 404 })
  const patch = parsePatch(await req.json().catch(() => null))
  if (!patch) return Response.json({ error: "Invalid request." }, { status: 400 })
  const r = await updateBooking(id, patch, a.admin.email)
  if (!r.ok) return Response.json({ error: r.error }, { status: r.status })
  if (patch.status) logEvent("booking_status", { id, status: patch.status, by: a.admin.email })
  return Response.json({ ok: true })
}
