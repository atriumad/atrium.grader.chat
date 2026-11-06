import { deleteDoc, getDoc, invalidatePinned, updateDoc } from "@/lib/admin/knowledge"
import { requireAdmin } from "@/lib/supabase/auth"

type Ctx = { params: Promise<{ id: string }> }
const UUID = /^[0-9a-f-]{36}$/i

export async function GET(_req: Request, ctx: Ctx) {
  const a = await requireAdmin()
  if ("error" in a) return a.error
  const { id } = await ctx.params
  if (!UUID.test(id)) return Response.json({ error: "No encontrado." }, { status: 404 })
  const doc = await getDoc(id)
  return doc ? Response.json(doc) : Response.json({ error: "No encontrado." }, { status: 404 })
}

export async function PATCH(req: Request, ctx: Ctx) {
  const a = await requireAdmin()
  if ("error" in a) return a.error
  const { id } = await ctx.params
  if (!UUID.test(id)) return Response.json({ error: "No encontrado." }, { status: 404 })
  const body = (await req.json().catch(() => null)) as Record<string, unknown> | null
  if (!body) return Response.json({ error: "Solicitud no válida." }, { status: 400 })
  try {
    await updateDoc(id, {
      title: typeof body.title === "string" ? body.title : undefined,
      tags: Array.isArray(body.tags) ? (body.tags as string[]) : undefined,
      pinned: typeof body.pinned === "boolean" ? body.pinned : undefined,
      enabled: typeof body.enabled === "boolean" ? body.enabled : undefined,
    })
    invalidatePinned()
    return Response.json({ ok: true })
  } catch (e) {
    return Response.json({ error: e instanceof Error ? e.message : "No se pudo actualizar." }, { status: 500 })
  }
}

export async function DELETE(_req: Request, ctx: Ctx) {
  const a = await requireAdmin()
  if ("error" in a) return a.error
  const { id } = await ctx.params
  if (!UUID.test(id)) return Response.json({ error: "No encontrado." }, { status: 404 })
  try {
    await deleteDoc(id)
    invalidatePinned()
    return Response.json({ ok: true })
  } catch (e) {
    return Response.json({ error: e instanceof Error ? e.message : "No se pudo eliminar." }, { status: 500 })
  }
}
