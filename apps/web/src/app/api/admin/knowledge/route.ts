import { addDoc, extractText, invalidatePinned, listDocs } from "@/lib/admin/knowledge"
import { requireAdmin } from "@/lib/supabase/auth"
import { supabaseConfigured } from "@/lib/supabase/server"

export const maxDuration = 60

export async function GET() {
  const a = await requireAdmin()
  if ("error" in a) return a.error
  if (!supabaseConfigured()) return Response.json({ error: "Supabase no configurado." }, { status: 503 })
  return Response.json({ docs: await listDocs() })
}

// multipart/form-data: file? | text?, title, tags (comma separated), pinned
export async function POST(req: Request) {
  const a = await requireAdmin()
  if ("error" in a) return a.error
  if (!supabaseConfigured()) return Response.json({ error: "Supabase no configurado." }, { status: 503 })
  try {
    const form = await req.formData()
    const file = form.get("file")
    const pasted = form.get("text")
    let content = ""
    let sourceName: string | null = null
    let kind = "note"
    if (file instanceof File && file.size > 0) {
      content = await extractText(file)
      sourceName = file.name.slice(0, 200)
      kind = file.name.toLowerCase().endsWith(".pdf") ? "pdf" : "file"
    } else if (typeof pasted === "string") {
      content = pasted
    }
    const title = String(form.get("title") ?? "").trim() || sourceName?.replace(/\.[^.]+$/, "") || "Note"
    const tags = String(form.get("tags") ?? "").split(",")
    const r = await addDoc({ title, content, kind, sourceName, tags, pinned: form.get("pinned") === "true", by: a.admin.email })
    invalidatePinned()
    return Response.json({ ok: true, ...r })
  } catch (e) {
    return Response.json({ error: e instanceof Error ? e.message : "Could not save the document." }, { status: 400 })
  }
}
