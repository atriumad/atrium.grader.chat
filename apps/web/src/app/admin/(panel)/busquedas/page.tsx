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

export default async function Lookups({ searchParams }: { searchParams: Promise<{ kind?: string; errors?: string }> }) {
  await connection()
  const sp = await searchParams
  const kind = KINDS.some((k) => k.id === sp.kind) ? sp.kind! : "all"
  const onlyErrors = sp.errors === "1"

  let q = db().from("lookup_logs").select("*").order("created_at", { ascending: false }).limit(100)
  if (kind !== "all") q = q.eq("kind", kind)
  if (onlyErrors) q = q.eq("ok", false)
  const { data, error } = await q

  const href = (k: string, e: boolean) => `/admin/busquedas?kind=${k}${e ? "&errors=1" : ""}`
  const chip = (on: boolean) =>
    `rounded-full border px-3 py-1 text-xs transition-colors ${on ? "bg-foreground text-background" : "text-muted-foreground hover:bg-secondary/60"}`

  return (
    <>
      <PageHeader title="Búsquedas">
        Qué devolvió cada consulta externa: la página web del negocio (de dónde salen las redes), las llamadas a ScrapeCreators con su respuesta cruda y qué se hizo con cada red (usada o descartada y por qué). Últimas 100.
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
            {data?.length ? (
              <ul className="-my-2 divide-y">
                {data.map((r) => (
                  <li key={r.id} className="py-2.5">
                    <details>
                      <summary className="flex cursor-pointer list-none items-baseline gap-3 text-sm">
                        <span className={`size-2 shrink-0 translate-y-px rounded-full ${r.ok ? "bg-emerald-500" : "bg-destructive"}`} role="img" aria-label={r.ok ? "correcto" : "fallo"} />
                        <span className="w-32 shrink-0 text-xs text-muted-foreground tnum">{when(r.created_at)}</span>
                        <span className="w-32 shrink-0 text-xs text-muted-foreground">{KIND_LABEL[r.kind] ?? r.kind}</span>
                        <span className="min-w-0 flex-1 truncate">{r.kind === "scrape" ? `${r.request?.path ?? ""} · ${r.target ?? ""}` : (r.target ?? "—")}</span>
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
                            <pre className="overflow-auto rounded-md bg-muted p-3 text-xs">{JSON.stringify(r.request, null, 2)}</pre>
                          </div>
                        ) : null}
                      </div>
                    </details>
                  </li>
                ))}
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
