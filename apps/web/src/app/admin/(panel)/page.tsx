import { Card, PageHeader, Stat } from "@/components/admin/ui"
import { db } from "@/lib/supabase/server"

type Overview = {
  analyses_7d: number
  analyses_30d: number
  analyses_total: number
  avg_score_30d: number | null
  by_source_30d: Record<string, number>
  chat_7d: number
  chat_30d: number
  bookings_30d: number
  errors_7d: number
  tools_30d: Record<string, number>
  credits_7d: number
  credits_30d: number
  credits_remaining: number | null
  daily: Array<{ day: string; analyses: number; chats: number }>
}

const TOOL_LABEL: Record<string, string> = {
  get_live_social_stats: "Redes en vivo",
  get_live_google_reputation: "Google Maps en vivo",
  audit_website_seo: "SEO del sitio",
  check_google_ranking: "Ranking en Google",
  search_agency_knowledge: "Base de conocimiento",
  get_availability: "Disponibilidad",
  propose_booking: "Propuesta de reunión",
}

const nf = new Intl.NumberFormat("es")
const when = (iso: string) => new Intl.DateTimeFormat("es", { dateStyle: "medium", timeStyle: "short" }).format(new Date(iso))

function Bars({ data }: { data: Overview["daily"] }) {
  const max = Math.max(1, ...data.map((d) => d.analyses))
  const w = 100 / data.length
  return (
    <figure className="flex flex-col gap-2">
      <svg viewBox="0 0 100 40" preserveAspectRatio="none" role="img" aria-label="Análisis por día, últimos 14 días" className="h-32 w-full">
        {data.map((d, i) => {
          const h = (d.analyses / max) * 34
          return <rect key={d.day} x={i * w + w * 0.15} y={38 - h} width={w * 0.7} height={Math.max(h, d.analyses ? 0.8 : 0.3)} rx="0.8" fill="var(--brand)" opacity={d.analyses ? 1 : 0.25} />
        })}
      </svg>
      <figcaption className="flex justify-between text-xs text-muted-foreground tnum">
        <span>{data[0]?.day.slice(5)}</span>
        <span>Análisis por día · máx. {max}</span>
        <span>{data[data.length - 1]?.day.slice(5)}</span>
      </figcaption>
    </figure>
  )
}

export default async function Overview() {
  const [ov, recent] = await Promise.all([
    db().rpc("admin_overview"),
    db().from("analyses").select("id, created_at, business_name, query, score, competitors, source, duration_ms").order("created_at", { ascending: false }).limit(15),
  ])
  if (ov.error)
    return (
      <>
        <PageHeader title="Resumen" />
        <p role="alert" className="text-sm text-destructive text-pretty">
          No pude leer las métricas ({ov.error.message}). ¿Ejecutaste supabase/migrations/0001_admin.sql?
        </p>
      </>
    )
  const o = ov.data as Overview
  const tools = Object.entries(o.tools_30d).sort((a, b) => b[1] - a[1])
  const toolMax = Math.max(1, ...tools.map(([, n]) => n))
  const sources = Object.entries(o.by_source_30d).map(([k, v]) => `${k === "mobile" ? "app" : "web"} ${nf.format(v)}`).join(" · ")

  return (
    <>
      <PageHeader title="Resumen">Uso de las apps y de las APIs externas. Los análisis y consultas se registran desde que conectaste Supabase.</PageHeader>
      <div className="flex flex-col gap-6">
        <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
          <Stat label="Análisis (7 días)" value={nf.format(o.analyses_7d)} sub={`${nf.format(o.analyses_30d)} en 30 días · ${nf.format(o.analyses_total)} en total`} />
          <Stat label="Puntaje promedio (30 d)" value={o.avg_score_30d ?? "—"} sub={sources || "sin análisis aún"} />
          <Stat label="Mensajes al chat (7 d)" value={nf.format(o.chat_7d)} sub={`${nf.format(o.chat_30d)} en 30 días`} />
          <Stat label="Reuniones agendadas (30 d)" value={nf.format(o.bookings_30d)} sub={o.errors_7d ? `${nf.format(o.errors_7d)} errores en 7 días` : "sin errores en 7 días"} />
        </div>

        <div className="grid gap-6 lg:grid-cols-[1.4fr_1fr]">
          <Card title="Actividad">
            <Bars data={o.daily} />
          </Card>
          <Card title="Créditos de ScrapeCreators" hint="Se suman las consultas a redes sociales y Google desde el registro.">
            <dl className="grid grid-cols-2 gap-y-3 text-sm">
              <dt className="text-muted-foreground">Últimos 7 días</dt>
              <dd className="text-right font-medium tnum">{nf.format(o.credits_7d)}</dd>
              <dt className="text-muted-foreground">Últimos 30 días</dt>
              <dd className="text-right font-medium tnum">{nf.format(o.credits_30d)}</dd>
              <dt className="text-muted-foreground">Saldo restante</dt>
              <dd className="text-right font-medium tnum">{o.credits_remaining === null ? "—" : nf.format(o.credits_remaining)}</dd>
              <dt className="text-muted-foreground">Por análisis (30 d)</dt>
              <dd className="text-right font-medium tnum">{o.analyses_30d ? (o.credits_30d / o.analyses_30d).toFixed(1) : "—"}</dd>
            </dl>
          </Card>
        </div>

        <Card title="Herramientas que usa el agente" hint="Últimos 30 días.">
          {tools.length ? (
            <ul className="flex flex-col gap-2.5">
              {tools.map(([name, n]) => (
                <li key={name} className="grid grid-cols-[10rem_1fr_3rem] items-center gap-3 text-sm">
                  <span className="truncate">{TOOL_LABEL[name] ?? name}</span>
                  <span className="h-1.5 rounded-full bg-muted">
                    <span className="block h-full rounded-full bg-foreground" style={{ width: `${(n / toolMax) * 100}%` }} />
                  </span>
                  <span className="text-right tnum">{nf.format(n)}</span>
                </li>
              ))}
            </ul>
          ) : (
            <p className="text-sm text-muted-foreground">Aún no hay consultas del agente.</p>
          )}
        </Card>

        <Card title="Análisis recientes">
          {recent.data?.length ? (
            <div className="-mx-4 overflow-x-auto sm:-mx-5">
              <table className="w-full min-w-[560px] border-collapse text-sm">
                <thead>
                  <tr className="text-left text-xs text-muted-foreground">
                    <th className="px-4 py-2 font-normal sm:px-5">Cuándo</th>
                    <th className="px-2 py-2 font-normal">Negocio</th>
                    <th className="px-2 py-2 text-right font-normal">Puntaje</th>
                    <th className="px-2 py-2 text-right font-normal">Competidores</th>
                    <th className="px-2 py-2 font-normal">Origen</th>
                    <th className="px-4 py-2 text-right font-normal sm:px-5">Duración</th>
                  </tr>
                </thead>
                <tbody>
                  {recent.data.map((r) => (
                    <tr key={r.id} className="border-t">
                      <td className="px-4 py-2.5 whitespace-nowrap text-muted-foreground sm:px-5">{when(r.created_at)}</td>
                      <td className="px-2 py-2.5">
                        <span className="font-medium">{r.business_name}</span>
                        <span className="block max-w-[28ch] truncate text-xs text-muted-foreground">{r.query}</span>
                      </td>
                      <td className="px-2 py-2.5 text-right tnum">{r.score ?? "—"}</td>
                      <td className="px-2 py-2.5 text-right tnum">{r.competitors}</td>
                      <td className="px-2 py-2.5">{r.source === "mobile" ? "App" : "Web"}</td>
                      <td className="px-4 py-2.5 text-right tnum sm:px-5">{r.duration_ms ? `${Math.round(r.duration_ms / 1000)} s` : "—"}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          ) : (
            <p className="text-sm text-muted-foreground">Todavía no hay análisis registrados. Haz uno en la app y aparecerá aquí.</p>
          )}
        </Card>
      </div>
    </>
  )
}
