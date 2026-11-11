"use client"

import * as React from "react"
import { useRouter } from "next/navigation"

import { Button } from "@/components/ui/button"
import { Card, inputCls, textareaCls } from "@/components/admin/ui"

type Doc = {
  id: string
  title: string
  kind: string
  source_name: string | null
  tags: string[]
  pinned: boolean
  enabled: boolean
  created_at: string
  created_by: string | null
  chars: number
  preview: string
}

const ACCEPT = ".pdf,.txt,.md,.markdown,.csv,.json"
const nf = new Intl.NumberFormat("en-US")

export function KnowledgeManager({ initial }: { initial: Doc[] }) {
  const router = useRouter()
  const [docs, setDocs] = React.useState(initial)
  const [seen, setSeen] = React.useState(initial)
  if (initial !== seen) {
    // Server data changed after router.refresh(): adopt it (derived state, no effect).
    setSeen(initial)
    setDocs(initial)
  }

  const [mode, setMode] = React.useState<"file" | "text">("file")
  const [file, setFile] = React.useState<File | null>(null)
  const [text, setText] = React.useState("")
  const [title, setTitle] = React.useState("")
  const [tags, setTags] = React.useState("")
  const [pinned, setPinned] = React.useState(false)
  const [busy, setBusy] = React.useState(false)
  const [msg, setMsg] = React.useState<{ ok: boolean; text: string } | null>(null)
  const [drag, setDrag] = React.useState(false)
  const inputRef = React.useRef<HTMLInputElement>(null)

  const [q, setQ] = React.useState("")
  const [hits, setHits] = React.useState<Array<{ title: string; content: string; rank: number }> | null>(null)
  const [searching, setSearching] = React.useState(false)

  const canSave = mode === "file" ? !!file : text.trim().length >= 20

  async function upload(e: React.FormEvent) {
    e.preventDefault()
    if (!canSave || busy) return
    setBusy(true)
    setMsg(null)
    const form = new FormData()
    if (mode === "file" && file) form.set("file", file)
    else form.set("text", text)
    form.set("title", title)
    form.set("tags", tags)
    form.set("pinned", String(pinned))
    const res = await fetch("/api/admin/knowledge", { method: "POST", body: form }).catch(() => null)
    const json = res ? await res.json().catch(() => ({})) : {}
    setBusy(false)
    if (res?.ok) {
      setMsg({ ok: true, text: `Saved in ${json.chunks} chunks. It is now available to the agents.` })
      setFile(null)
      setText("")
      setTitle("")
      setTags("")
      setPinned(false)
      router.refresh()
    } else setMsg({ ok: false, text: json.error ?? "Could not save." })
  }

  async function patch(id: string, body: Record<string, unknown>) {
    setDocs((d) => d.map((x) => (x.id === id ? ({ ...x, ...body } as Doc) : x)))
    const res = await fetch(`/api/admin/knowledge/${id}`, { method: "PATCH", headers: { "Content-Type": "application/json" }, body: JSON.stringify(body) }).catch(() => null)
    if (!res?.ok) router.refresh()
  }

  async function remove(d: Doc) {
    if (!window.confirm(`Delete "${d.title}"? This cannot be undone.`)) return
    setDocs((x) => x.filter((y) => y.id !== d.id))
    const res = await fetch(`/api/admin/knowledge/${d.id}`, { method: "DELETE" }).catch(() => null)
    if (!res?.ok) router.refresh()
  }

  async function search(e: React.FormEvent) {
    e.preventDefault()
    if (q.trim().length < 2) return
    setSearching(true)
    const res = await fetch("/api/admin/knowledge/search", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ query: q }) }).catch(() => null)
    const json = res ? await res.json().catch(() => ({})) : {}
    setSearching(false)
    setHits(res?.ok ? json.hits : [])
  }

  return (
    <div className="grid gap-6 xl:grid-cols-[22rem_1fr]">
      <div className="flex flex-col gap-6">
        <Card title="Add content" hint="PDF, TXT, MD, CSV or JSON (up to 5 MB), or paste the text.">
          <form onSubmit={upload} className="flex flex-col gap-3">
            <div role="tablist" aria-label="Content type" className="flex gap-1 rounded-lg bg-muted p-1 text-sm">
              {(["file", "text"] as const).map((m) => (
                <button key={m} type="button" role="tab" aria-selected={mode === m} onClick={() => setMode(m)} className={`flex-1 rounded-md px-3 py-1 transition-colors ${mode === m ? "bg-card font-medium shadow-sm" : "text-muted-foreground"}`}>
                  {m === "file" ? "File" : "Paste text"}
                </button>
              ))}
            </div>

            {mode === "file" ? (
              <div
                onDragOver={(e) => {
                  e.preventDefault()
                  setDrag(true)
                }}
                onDragLeave={() => setDrag(false)}
                onDrop={(e) => {
                  e.preventDefault()
                  setDrag(false)
                  const f = e.dataTransfer.files?.[0]
                  if (f) setFile(f)
                }}
                className={`flex flex-col items-center gap-2 rounded-xl border border-dashed p-5 text-center text-sm transition-colors ${drag ? "border-brand bg-secondary" : ""}`}
              >
                <input ref={inputRef} type="file" accept={ACCEPT} className="sr-only" onChange={(e) => setFile(e.target.files?.[0] ?? null)} />
                {file ? (
                  <p className="font-medium break-all">
                    {file.name} <span className="font-normal text-muted-foreground">· {Math.round(file.size / 1024)} KB</span>
                  </p>
                ) : (
                  <p className="text-muted-foreground">Drag a file here</p>
                )}
                <Button type="button" variant="outline" size="sm" onClick={() => inputRef.current?.click()}>
                  {file ? "Change file" : "Choose file"}
                </Button>
              </div>
            ) : (
              <textarea className={textareaCls} rows={8} value={text} onChange={(e) => setText(e.target.value)} placeholder="E.g.: Services: Instagram management from… Case studies: …" />
            )}

            <label className="flex flex-col gap-1 text-sm">
              <span className="font-medium">Title</span>
              <input className={inputCls} value={title} maxLength={160} onChange={(e) => setTitle(e.target.value)} placeholder={file ? file.name.replace(/\.[^.]+$/, "") : "Services and prices"} />
            </label>
            <label className="flex flex-col gap-1 text-sm">
              <span className="font-medium">Tags</span>
              <input className={inputCls} value={tags} onChange={(e) => setTags(e.target.value)} placeholder="services, case studies, prices" />
            </label>
            <label className="flex cursor-pointer items-start gap-2.5 text-sm">
              <input type="checkbox" className="mt-0.5 size-4 accent-[var(--brand)]" checked={pinned} onChange={(e) => setPinned(e.target.checked)} />
              <span className="text-pretty">
                <span className="font-medium">Always use</span>
                <span className="block text-xs text-muted-foreground">Included in every chat and analysis (up to ~6,000 characters in total). For what is essential and short.</span>
              </span>
            </label>
            <Button type="submit" disabled={!canSave || busy}>
              {busy ? "Processing…" : "Save"}
            </Button>
            {msg ? (
              <p role={msg.ok ? "status" : "alert"} className={`text-sm text-pretty ${msg.ok ? "text-positive" : "text-destructive"}`}>
                {msg.text}
              </p>
            ) : null}
          </form>
        </Card>

        <Card title="Test search" hint="See which chunks the agent would receive for a question.">
          <form onSubmit={search} className="flex gap-2">
            <input className={inputCls} value={q} onChange={(e) => setQ(e.target.value)} placeholder="What services do you offer?" />
            <Button type="submit" variant="outline" disabled={searching || q.trim().length < 2}>
              {searching ? "…" : "Search"}
            </Button>
          </form>
          {hits ? (
            hits.length ? (
              <ul className="mt-3 flex flex-col gap-3">
                {hits.map((h, i) => (
                  <li key={i} className="rounded-lg bg-muted p-3 text-xs/relaxed">
                    <span className="mb-1 block font-medium">{h.title}</span>
                    <span className="line-clamp-5 text-muted-foreground">{h.content}</span>
                  </li>
                ))}
              </ul>
            ) : (
              <p className="mt-3 text-sm text-muted-foreground">No results. The agent would say it does not have that information.</p>
            )
          ) : null}
        </Card>
      </div>

      <Card title={`Documents (${docs.length})`}>
        {docs.length ? (
          <ul className="flex flex-col divide-y">
            {docs.map((d) => (
              <li key={d.id} className={`flex flex-col gap-2 py-4 first:pt-0 last:pb-0 ${d.enabled ? "" : "opacity-60"}`}>
                <div className="flex items-start justify-between gap-3">
                  <div className="min-w-0">
                    <h3 className="font-medium text-pretty">{d.title}</h3>
                    <p className="text-xs text-muted-foreground tnum">
                      {d.source_name ?? "Pasted text"} · {nf.format(d.chars)} characters · {new Date(d.created_at).toLocaleDateString("es", { dateStyle: "medium" })}
                      {d.created_by ? ` · ${d.created_by}` : ""}
                    </p>
                  </div>
                  <Button variant="ghost" size="xs" onClick={() => void remove(d)}>
                    Delete
                  </Button>
                </div>
                <p className="line-clamp-2 text-sm text-muted-foreground text-pretty">{d.preview}</p>
                <div className="flex flex-wrap items-center gap-x-5 gap-y-2 text-sm">
                  <label className="flex cursor-pointer items-center gap-2">
                    <input type="checkbox" className="size-4 accent-[var(--brand)]" checked={d.enabled} onChange={(e) => void patch(d.id, { enabled: e.target.checked })} />
                    Active
                  </label>
                  <label className="flex cursor-pointer items-center gap-2">
                    <input type="checkbox" className="size-4 accent-[var(--brand)]" checked={d.pinned} onChange={(e) => void patch(d.id, { pinned: e.target.checked })} />
                    Always use
                  </label>
                  {d.tags.map((t) => (
                    <span key={t} className="rounded-full bg-secondary px-2 py-0.5 text-xs text-muted-foreground">
                      {t}
                    </span>
                  ))}
                </div>
              </li>
            ))}
          </ul>
        ) : (
          <p className="text-sm text-muted-foreground text-pretty">No content yet. Upload your first document: for example, your services and a case study.</p>
        )}
      </Card>
    </div>
  )
}
