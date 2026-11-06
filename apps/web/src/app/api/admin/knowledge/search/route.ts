import { searchKnowledge } from "@/lib/admin/knowledge"
import { requireAdmin } from "@/lib/supabase/auth"

// "Probar búsqueda": shows what the agent would get back for a query.
export async function POST(req: Request) {
  const a = await requireAdmin()
  if ("error" in a) return a.error
  const body = (await req.json().catch(() => null)) as { query?: unknown } | null
  const q = typeof body?.query === "string" ? body.query.trim() : ""
  if (q.length < 2) return Response.json({ error: "Escribe una consulta." }, { status: 400 })
  try {
    return Response.json({ hits: await searchKnowledge(q, 5) })
  } catch (e) {
    return Response.json({ error: e instanceof Error ? e.message : "Error de búsqueda." }, { status: 500 })
  }
}
