import { db, supabaseConfigured } from "@/lib/supabase/server"

export const MAX_FILE_BYTES = 5 * 1024 * 1024
const MAX_TEXT_CHARS = 200_000
const CHUNK_CHARS = 1000

// Splits on paragraphs and packs them up to ~CHUNK_CHARS; long paragraphs are cut by sentence.
export function chunkText(text: string): string[] {
  const parts = text
    .replace(/\r\n/g, "\n")
    .split(/\n{2,}/)
    .flatMap((p) => (p.length <= CHUNK_CHARS ? [p] : p.match(/[^.!?\n]+[.!?]*\s*/g) ?? [p]))
    .map((p) => p.trim())
    .filter(Boolean)
  const chunks: string[] = []
  let cur = ""
  for (const p of parts) {
    if (cur && cur.length + p.length + 2 > CHUNK_CHARS) {
      chunks.push(cur)
      cur = ""
    }
    cur = cur ? `${cur}\n\n${p}` : p
    while (cur.length > CHUNK_CHARS * 1.5) {
      chunks.push(cur.slice(0, CHUNK_CHARS))
      cur = cur.slice(CHUNK_CHARS)
    }
  }
  if (cur) chunks.push(cur)
  return chunks
}

export async function extractText(file: File): Promise<string> {
  if (file.size > MAX_FILE_BYTES) throw new Error("The file is larger than 5 MB.")
  const name = file.name.toLowerCase()
  if (name.endsWith(".pdf") || file.type === "application/pdf") {
    const { extractText: pdfText, getDocumentProxy } = await import("unpdf")
    const pdf = await getDocumentProxy(new Uint8Array(await file.arrayBuffer()))
    const { text } = await pdfText(pdf, { mergePages: true })
    return text
  }
  if (/\.(txt|md|markdown|csv|json)$/.test(name) || file.type.startsWith("text/") || file.type === "application/json") {
    return await file.text()
  }
  throw new Error("Unsupported format. Upload PDF, TXT, MD, CSV or JSON, or paste the text.")
}

export async function addDoc(input: {
  title: string
  content: string
  kind?: string
  sourceName?: string | null
  tags?: string[]
  pinned?: boolean
  by: string
}) {
  const content = input.content.replace(/\u0000/g, "").trim().slice(0, MAX_TEXT_CHARS)
  if (content.length < 20) throw new Error("The content is too short or no text could be read from the file.")
  const { data, error } = await db()
    .from("knowledge_docs")
    .insert({
      title: input.title.trim().slice(0, 160) || "Untitled",
      kind: input.kind ?? "note",
      source_name: input.sourceName ?? null,
      content,
      tags: (input.tags ?? []).map((t) => t.trim().toLowerCase().slice(0, 30)).filter(Boolean).slice(0, 10),
      pinned: !!input.pinned,
      created_by: input.by,
    })
    .select("id")
    .single()
  if (error) throw new Error(error.message)
  const chunks = chunkText(content)
  const rows = chunks.map((c, idx) => ({ doc_id: data.id, idx, content: c }))
  for (let i = 0; i < rows.length; i += 200) {
    const { error: e2 } = await db().from("knowledge_chunks").insert(rows.slice(i, i + 200))
    if (e2) {
      await db().from("knowledge_docs").delete().eq("id", data.id)
      throw new Error(e2.message)
    }
  }
  return { id: data.id as string, chunks: chunks.length }
}

export async function listDocs() {
  const { data, error } = await db()
    .from("knowledge_docs")
    .select("id, title, kind, source_name, tags, pinned, enabled, created_at, created_by, content")
    .order("created_at", { ascending: false })
  if (error) throw new Error(error.message)
  return (data ?? []).map((d) => ({ ...d, chars: (d.content as string).length, preview: (d.content as string).slice(0, 220), content: undefined }))
}

export async function updateDoc(id: string, patch: { title?: string; tags?: string[]; pinned?: boolean; enabled?: boolean }) {
  const row: Record<string, unknown> = {}
  if (typeof patch.title === "string") row.title = patch.title.trim().slice(0, 160)
  if (Array.isArray(patch.tags)) row.tags = patch.tags.map((t) => String(t).trim().toLowerCase().slice(0, 30)).filter(Boolean).slice(0, 10)
  if (typeof patch.pinned === "boolean") row.pinned = patch.pinned
  if (typeof patch.enabled === "boolean") row.enabled = patch.enabled
  if (!Object.keys(row).length) return
  const { error } = await db().from("knowledge_docs").update(row).eq("id", id)
  if (error) throw new Error(error.message)
}

export async function deleteDoc(id: string) {
  const { error } = await db().from("knowledge_docs").delete().eq("id", id)
  if (error) throw new Error(error.message)
}

export async function getDoc(id: string) {
  const { data, error } = await db().from("knowledge_docs").select("id, title, content").eq("id", id).maybeSingle()
  if (error) throw new Error(error.message)
  return data as { id: string; title: string; content: string } | null
}

// `at` uses performance.now() (Next rejects Date.now() while prerendering); -Infinity = never loaded.
const pinnedCache: { at: number; text: string } = { at: -Infinity, text: "" }

// Documents flagged "siempre usar": injected whole (capped) into the prompts.
export async function pinnedKnowledge(maxChars = 6000): Promise<string> {
  if (!supabaseConfigured()) return ""
  if (performance.now() - pinnedCache.at < 30_000) return pinnedCache.text
  try {
    const { data } = await db().from("knowledge_docs").select("title, content").eq("pinned", true).eq("enabled", true).order("created_at")
    let out = ""
    for (const d of data ?? []) {
      const block = `## ${d.title}\n${d.content}\n\n`
      if (out.length + block.length > maxChars) {
        out += block.slice(0, Math.max(0, maxChars - out.length))
        break
      }
      out += block
    }
    pinnedCache.at = performance.now()
    pinnedCache.text = out.trim()
  } catch {
    // keep the previous value
  }
  return pinnedCache.text
}

export function invalidatePinned() {
  pinnedCache.at = 0
}

export async function searchKnowledge(query: string, n = 4) {
  if (!supabaseConfigured()) return []
  const { data, error } = await db().rpc("search_knowledge", { q: query.slice(0, 300), n })
  if (error) throw new Error(error.message)
  return (data ?? []) as Array<{ doc_id: string; title: string; content: string; rank: number }>
}
