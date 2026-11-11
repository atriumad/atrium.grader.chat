import { configHistory, getAgent, getScoring, resetConfig, saveConfig, type ConfigKey } from "@/lib/admin/config"
import { serializeScoreConfig } from "@/lib/metrics"
import { requireAdmin } from "@/lib/supabase/auth"
import { supabaseConfigured } from "@/lib/supabase/server"

const isKey = (k: string): k is ConfigKey => k === "scoring" || k === "agent"

type Ctx = { params: Promise<{ key: string }> }

export async function GET(_req: Request, ctx: Ctx) {
  const a = await requireAdmin()
  if ("error" in a) return a.error
  const { key } = await ctx.params
  if (!isKey(key) || !supabaseConfigured()) return Response.json({ error: "No encontrado." }, { status: 404 })
  const cur = key === "scoring" ? await getScoring(true) : await getAgent(true)
  return Response.json({
    value: key === "scoring" ? serializeScoreConfig(cur.config as never) : cur.config,
    custom: cur.custom,
    updatedAt: cur.updatedAt,
    updatedBy: cur.updatedBy,
    history: await configHistory(key),
  })
}

// Publish. The body is sanitized again on the server: the client is never trusted.
export async function PUT(req: Request, ctx: Ctx) {
  const a = await requireAdmin()
  if ("error" in a) return a.error
  const { key } = await ctx.params
  if (!isKey(key) || !supabaseConfigured()) return Response.json({ error: "No encontrado." }, { status: 404 })
  const body = (await req.json().catch(() => null)) as { value?: unknown; note?: unknown } | null
  if (!body || body.value === undefined) return Response.json({ error: "Invalid request." }, { status: 400 })
  try {
    const value = await saveConfig(key, body.value, a.admin.email, typeof body.note === "string" ? body.note : undefined)
    return Response.json({ ok: true, value })
  } catch (e) {
    return Response.json({ error: e instanceof Error ? e.message : "Could not save." }, { status: 500 })
  }
}

export async function DELETE(_req: Request, ctx: Ctx) {
  const a = await requireAdmin()
  if ("error" in a) return a.error
  const { key } = await ctx.params
  if (!isKey(key) || !supabaseConfigured()) return Response.json({ error: "No encontrado." }, { status: 404 })
  try {
    await resetConfig(key, a.admin.email)
    return Response.json({ ok: true })
  } catch (e) {
    return Response.json({ error: e instanceof Error ? e.message : "Could not reset." }, { status: 500 })
  }
}
