import { Suspense } from "react"
import { connection } from "next/server"
import Link from "next/link"

import { Card, PageHeader, PanelSkeleton } from "@/components/admin/ui"
import { db } from "@/lib/supabase/server"
import { assertAdmin } from "@/lib/supabase/auth"

const PAGE_SIZE = 25
const SOURCES = [
  { id: "all", label: "All" },
  { id: "web", label: "Web" },
  { id: "mobile", label: "App" },
]

const when = (iso: string) => new Intl.DateTimeFormat("en-US", { dateStyle: "medium", timeStyle: "short" }).format(new Date(iso))
const TIER = (s: number | null) => (s === null ? "bg-muted-foreground/40" : s >= 70 ? "bg-emerald-500" : s >= 40 ? "bg-amber-500" : "bg-destructive")

type Sp = { q?: string; source?: string; page?: string }

async function AnalysesContent({ searchParams }: { searchParams: Promise<Sp> }) {
  await connection()
  await assertAdmin()
  const sp = await searchParams
  const q = (sp.q ?? "").trim().slice(0, 100)
  const source = SOURCES.some((s) => s.id === sp.source) ? sp.source! : "all"
  const page = Math.max(1, Number.parseInt(sp.page ?? "1", 10) || 1)

  let query = db()
    .from("analyses")
    .select("id, created_at, business_name, query, score, competitors, source, duration_ms", { count: "exact" })
    .order("created_at", { ascending: false })
    .range((page - 1) * PAGE_SIZE, page * PAGE_SIZE - 1)
  if (source !== "all") query = query.eq("source", source)
  // Strip characters that have meaning inside a PostgREST filter before interpolating.
  const safe = q.replace(/[%,()*\\]/g, " ").trim()
  if (safe) query = query.or(`business_name.ilike.%${safe}%,query.ilike.%${safe}%`)
  const { data, error, count } = await query

  const total = count ?? 0
  const pages = Math.max(1, Math.ceil(total / PAGE_SIZE))
  const href = (over: Partial<Sp>) => {
    const p = new URLSearchParams()
    const next = { q, source, page: String(page), ...over }
    if (next.q) p.set("q", next.q)
    if (next.source && next.source !== "all") p.set("source", next.source)
    if (next.page && next.page !== "1") p.set("page", next.page)
    const s = p.toString()
    return `/admin/analisis${s ? `?${s}` : ""}`
  }
  const chip = (on: boolean) => `rounded-full border px-3 py-1 text-xs transition-colors ${on ? "bg-foreground text-background" : "text-muted-foreground hover:bg-secondary/60"}`

  return (
    <>
      <div className="flex flex-col gap-4">
        <div className="flex flex-wrap items-center gap-2">
          <form action="/admin/analisis" className="flex-1 basis-56">
            <input type="hidden" name="source" value={source === "all" ? "" : source} />
            <label htmlFor="admin-q" className="sr-only">Search by business</label>
            <input
              id="admin-q"
              name="q"
              defaultValue={q}
              placeholder="Search by business or searched text"
              className="h-9 w-full rounded-md border bg-background px-3 text-sm outline-none focus-visible:ring-3 focus-visible:ring-ring/30"
            />
          </form>
          {SOURCES.map((s) => (
            <Link key={s.id} href={href({ source: s.id, page: "1" })} className={chip(source === s.id)}>
              {s.label}
            </Link>
          ))}
        </div>

        {error ? (
          <p role="alert" className="text-sm text-destructive text-pretty">I could not read the analyses ({error.message}).</p>
        ) : (
          <Card>
            {data?.length ? (
              <div className="-mx-4 -my-4 overflow-x-auto sm:-mx-5 sm:-my-5">
                <table className="w-full min-w-[600px] border-collapse text-sm">
                  <thead>
                    <tr className="text-left text-xs text-muted-foreground">
                      <th className="px-4 py-2.5 font-normal sm:px-5">Business</th>
                      <th className="px-2 py-2.5 text-right font-normal">Score</th>
                      <th className="px-2 py-2.5 text-right font-normal">Competitors</th>
                      <th className="px-2 py-2.5 font-normal">Source</th>
                      <th className="px-2 py-2.5 text-right font-normal">Duration</th>
                      <th className="px-4 py-2.5 font-normal sm:px-5">When</th>
                    </tr>
                  </thead>
                  <tbody>
                    {data.map((r) => (
                      <tr key={r.id} className="border-t transition-colors hover:bg-secondary/50">
                        <td className="px-4 py-2.5 sm:px-5">
                          <Link href={`/admin/analisis/${r.id}`} className="font-medium underline-offset-4 hover:underline">
                            {r.business_name}
                          </Link>
                          <span className="block max-w-[32ch] truncate text-xs text-muted-foreground">{r.query}</span>
                        </td>
                        <td className="px-2 py-2.5 text-right tnum">
                          <span className="inline-flex items-center gap-2">
                            <span className={`size-2 rounded-full ${TIER(r.score)}`} aria-hidden="true" />
                            {r.score ?? "—"}
                          </span>
                        </td>
                        <td className="px-2 py-2.5 text-right tnum">{r.competitors}</td>
                        <td className="px-2 py-2.5">{r.source === "mobile" ? "App" : "Web"}</td>
                        <td className="px-2 py-2.5 text-right tnum">{r.duration_ms ? `${Math.round(r.duration_ms / 1000)} s` : "—"}</td>
                        <td className="px-4 py-2.5 whitespace-nowrap text-muted-foreground sm:px-5">{when(r.created_at)}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            ) : (
              <p className="text-sm text-muted-foreground">{safe || source !== "all" ? "No analysis matches that filter." : "No analyses recorded yet."}</p>
            )}
          </Card>
        )}

        <nav aria-label="Pagination" className="flex items-center justify-between text-sm text-muted-foreground">
          <span className="tnum">{nfTotal(total)} {total === 1 ? "analysis" : "analyses"} · page {Math.min(page, pages)} of {pages}</span>
          <span className="flex gap-2">
            {page > 1 ? <Link href={href({ page: String(page - 1) })} className={chip(false)}>Previous</Link> : null}
            {page < pages ? <Link href={href({ page: String(page + 1) })} className={chip(false)}>Next</Link> : null}
          </span>
        </nav>
      </div>
    </>
  )
}

const nfTotal = (n: number) => new Intl.NumberFormat("en-US").format(n)

export default function Analyses({ searchParams }: { searchParams: Promise<Sp> }) {
  return (
    <>
      <PageHeader title="Analyses">Every business that went through the grader. Open one to see the report as the customer saw it.</PageHeader>
      <Suspense fallback={<PanelSkeleton label="Loading analyses" className="h-96" />}>
        <AnalysesContent searchParams={searchParams} />
      </Suspense>
    </>
  )
}
