import { connection } from "next/server"
import Link from "next/link"

import { Card, PageHeader } from "@/components/admin/ui"
import { db } from "@/lib/supabase/server"

const KINDS: Array<{ id: string; label: string }> = [
  { id: "all", label: "Todo" },
  { id: "links", label: "Sitio web → redes" },
  { id: "scrape", label: "Consultas API" },
  { id: "network", label: "Resultado por red" },
]
const KIND_LABEL: Record<string, string> = Object.fromEntries(KINDS.map((k) => [k.id, k.label]))

const when = (iso: string) => new Intl.DateTimeFormat("es", { dateStyle: "short", timeStyle: "medium" }).format(new Date(iso))

function pretty(raw: string | null): string {
  if (!raw) return ""
  try {
    return JSON.stringify(JSON.parse(raw), null, 2)
  } catch {
    return raw
  }
}

type Row = {
  id: number
  created_at: string
  kind: string
  target: string | null
  request: Record<string, unknown> | null
  ok: boolean
  status: number | null
  duration_ms: number | null
  summary: unknown
  response: string | null
  error: string | null
}
type Group = { key: string; name: string; query: string | null; at: string; rows: Row[] }

type Ctx = { run?: string; query?: string; business?: string | null }
const ctxOf = (r: Row): Ctx | null => (r.request && typeof r.request._ctx === "object" ? (r.request._ctx as Ctx) : null)

// One group per analysis (rows come newest first). Lookups from before the context existed
// have no client, so they share a single group at the end.
function groupByClient(rows: Row[]): Group[] {
  const groups = new Map<string, Group>()
  for (const r of rows) {
    const c = ctxOf(r)
    const key = c?.run ?? "legacy"
    let g = groups.get(key)
    if (!g) {
      g = { key, name: key === "legacy" ? "Sin cliente (registros anteriores)" : "", query: c?.query ?? null, at: r.created_at, rows: [] }
      groups.set(key, g)
    }
    if (c?.business && !g.name) g.name = c.business
    g.rows.push(r)
  }
  const list = [...groups.values()].map((g) => ({ ...g, name: g.name || g.query || "Cliente sin identificar" }))
  return list.sort((a, b) => (a.key === "legacy" ? 1 : b.key === "legacy" ? -1 : b.at.localeCompare(a.at)))
}

// The request as stored, minus the internal client tag.
function cleanRequest(req: Record<string, unknown> | null) {
  if (!req) return {}
  const { _ctx: _omit, ...rest } = req
  void _omit
  return rest
}

export default async function Lookups({ searchParams }: { searchParams: Promise<{ kind?: string; errors?: string }> }) {
  await connection()
  const sp = await searchParams
  const kind = KINDS.some((k) => k.id === sp.kind) ? sp.kind! : "all"
  const onlyErrors = sp.errors === "1"

  let q = db().from("lookup_logs").select("*").order("created_at", { ascending: false }).limit(400)
  if (kind !== "all") q = q.eq("kind", kind)
  if (onlyErrors) q = q.eq("ok", false)
  const { data, error } = await q
  const groups = groupByClient((data ?? []) as Row[])

  const href = (k: string, e: boolean) => `/admin/busquedas?kind=${k}${e ? "&errors=1" : ""}`
  const chip = (on: boolean) =>
    `rounded-full border px-3 py-1 text-xs transition-colors ${on ? "bg-foreground text-background" : "text-muted-foreground hover:bg-secondary/60"}`

  return (
    <>
      <PageHeader title="Búsquedas">
        Qué devolvió cada consulta externa: la página web del negocio (de dónde salen las redes), las llamadas a ScrapeCreators con su respuesta cruda y qué se hizo con cada red (usada o descartada y por qué). Cada fila es un cliente analizado; ábrela para ver sus peticiones. Últimas 400 consultas.
      </PageHeader>
      {error ? (
        <p role="alert" className="text-sm text-destructive text-pretty">
          No pude leer el registro ({error.message}). ¿Ejecutaste supabase/migrations/0002_lookup_logs.sql?
        </p>
      ) : (
        <div className="flex flex-col gap-4">
          <div className="flex flex-wrap gap-2">
            {KINDS.map((k) => (
              <Link key={k.id} href={href(k.id, onlyErrors)} className={chip(kind === k.id)}>
                {k.label}
              </Link>
            ))}
            <Link href={href(kind, !onlyErrors)} className={chip(onlyErrors)}>
              Solo fallos
            </Link>
          </div>
          <Card>
            {groups.length ? (
              <ul className="-my-2 divide-y">
                {groups.map((g) => {
                  const fails = g.rows.filter((r) => !r.ok).length
                  const kinds = [...new Set(g.rows.map((r) => KIND_LABEL[r.kind] ?? r.kind))].join(" · ")
                  return (
                    <li key={g.key} className="py-3">
                      <details>
                        <summary className="flex cursor-pointer list-none items-baseline gap-3 text-sm">
                          <span className={`size-2 shrink-0 translate-y-px rounded-full ${fails ? "bg-destructive" : "bg-emerald-500"}`} role="img" aria-label={fails ? "con fallos" : "todo correcto"} />
                          <span className="min-w-0 flex-1">
                            <span className="block truncate font-medium">{g.name}</span>
                            <span className="block truncate text-xs text-muted-foreground">{kinds}</span>
                          </span>
                          <span className="hidden w-32 shrink-0 text-xs text-muted-foreground tnum sm:block">{g.key === "legacy" ? "" : when(g.at)}</span>
                          <span className="shrink-0 text-xs text-muted-foreground tnum">
                            {g.rows.length} {g.rows.length === 1 ? "consulta" : "consultas"}
                            {fails ? <span className="text-destructive"> · {fails} {fails === 1 ? "fallo" : "fallos"}</span> : null}
                          </span>
                        </summary>
                        <ul className="mt-3 ml-5 divide-y border-l pl-4">
                          {g.rows.map((r) => (
                            <li key={r.id} className="py-2.5">
                              <details>
                                <summary className="flex cursor-pointer list-none items-baseline gap-3 text-sm">
                                  <span className={`size-2 shrink-0 translate-y-px rounded-full ${r.ok ? "bg-emerald-500" : "bg-destructive"}`} role="img" aria-label={r.ok ? "correcto" : "fallo"} />
                                  <span className="w-20 shrink-0 text-xs text-muted-foreground tnum">{new Intl.DateTimeFormat("es", { timeStyle: "medium" }).format(new Date(r.created_at))}</span>
                                  <span className="hidden w-32 shrink-0 text-xs text-muted-foreground sm:block">{KIND_LABEL[r.kind] ?? r.kind}</span>
                                  <span className="min-w-0 flex-1 truncate">{r.kind === "scrape" ? `${String(r.request?.path ?? "")} · ${r.target ?? ""}` : (r.target ?? "—")}</span>
                                  <span className="shrink-0 text-xs text-muted-foreground tnum">
                                    {r.status ?? ""} {r.duration_ms != null ? `${r.duration_ms} ms` : ""}
                                  </span>
                                </summary>
                                <div className="mt-3 flex flex-col gap-3 pl-5">
                                  {r.error ? <p className="text-sm text-destructive text-pretty">{r.error}</p> : null}
                                  {r.summary ? (
                                    <div>
                                      <h3 className="mb-1 text-xs font-medium text-muted-foreground">Resumen</h3>
                                      <pre className="max-h-72 overflow-auto rounded-md bg-muted p-3 text-xs">{JSON.stringify(r.summary, null, 2)}</pre>
                                    </div>
                                  ) : null}
                                  {r.response ? (
                                    <div>
                                      <h3 className="mb-1 text-xs font-medium text-muted-foreground">Respuesta cruda (máx. 8 KB)</h3>
                                      <pre className="max-h-96 overflow-auto rounded-md bg-muted p-3 text-xs">{pretty(r.response)}</pre>
                                    </div>
                                  ) : null}
                                  {r.kind === "scrape" ? (
                                    <div>
                                      <h3 className="mb-1 text-xs font-medium text-muted-foreground">Petición</h3>
                                      <pre className="overflow-auto rounded-md bg-muted p-3 text-xs">{JSON.stringify(cleanRequest(r.request), null, 2)}</pre>
                                    </div>
                                  ) : null}
                                </div>
                              </details>
                            </li>
                          ))}
                        </ul>
                      </details>
                    </li>
                  )
                })}
              </ul>
            ) : (
              <p className="text-sm text-muted-foreground">Sin registros todavía. Haz un análisis y aparecerán aquí.</p>
            )}
          </Card>
        </div>
      )}
    </>
  )
}
