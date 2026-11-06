"use client"

import * as React from "react"
import { useRouter } from "next/navigation"

import { Button } from "@/components/ui/button"
import { Card, inputCls } from "@/components/admin/ui"
import type { Dataset } from "@/lib/analysis"
import {
  PART_LABEL,
  TIER_VAR,
  sanitizeScoreConfig,
  serializeScoreConfig,
  toRows,
  withScoreConfig,
  type PartKey,
  type ScoreConfig,
} from "@/lib/metrics"

type Sample = { id: string; name: string; at: string; dataset: Dataset }
type Hist = { id: number; value: unknown; note: string | null; at: string; by: string | null }

// A number field that lets you type freely ("3.", "") and commits valid numbers up.
function Num({ label, hint, value, onChange, step = 1, min, max }: { label: string; hint?: string; value: number; onChange: (n: number) => void; step?: number; min?: number; max?: number }) {
  // While typing, show exactly what was typed ("3.", ""); otherwise show the value.
  const [typed, setTyped] = React.useState<string | null>(null)
  const text = typed ?? String(value)
  return (
    <label className="flex flex-col gap-1 text-sm">
      <span className="font-medium">{label}</span>
      <input
        type="number"
        inputMode="decimal"
        value={text}
        step={step}
        min={min}
        max={max}
        onBlur={() => setTyped(null)}
        onChange={(e) => {
          setTyped(e.target.value)
          const n = Number(e.target.value)
          if (e.target.value !== "" && Number.isFinite(n)) onChange(n)
        }}
        className={inputCls}
      />
      {hint ? <span className="text-xs text-muted-foreground text-pretty">{hint}</span> : null}
    </label>
  )
}

const PARTS: PartKey[] = ["engagement", "reputation", "activity", "audience", "presence"]
const NETS = ["instagram", "tiktok", "facebook", "youtube"] as const

// Deep copy through the JSON-safe form; sanitize puts Infinity back on the open-ended tier.
const clone = (c: ScoreConfig): ScoreConfig => sanitizeScoreConfig(JSON.parse(JSON.stringify(serializeScoreConfig(c))))
const norm = (x: unknown) => sanitizeScoreConfig(x)
const same = (a: ScoreConfig, b: ScoreConfig) => JSON.stringify(serializeScoreConfig(a)) === JSON.stringify(serializeScoreConfig(b))

function preview(samples: Sample[], cfg: ScoreConfig) {
  return withScoreConfig(cfg, () =>
    samples.map((s) => {
      try {
        const you = toRows(s.dataset).find((r) => r.isYou)
        return you ? { score: you.score, rank: you.rank, tier: you.tier } : null
      } catch {
        return null
      }
    })
  )
}

export function ScoringEditor({
  published,
  defaults,
  custom,
  updatedAt,
  updatedBy,
  history,
  samples,
}: {
  published: unknown
  defaults: unknown
  custom: boolean
  updatedAt: string | null
  updatedBy: string | null
  history: Hist[]
  samples: Sample[]
}) {
  const router = useRouter()
  const pub = React.useMemo(() => norm(published), [published])
  const def = React.useMemo(() => norm(defaults), [defaults])
  const [draft, setDraft] = React.useState<ScoreConfig>(() => clone(pub))
  const [note, setNote] = React.useState("")
  const [busy, setBusy] = React.useState(false)
  const [msg, setMsg] = React.useState<{ ok: boolean; text: string } | null>(null)

  const edit = (fn: (d: ScoreConfig) => void) =>
    setDraft((d) => {
      const n = clone(d)
      fn(n)
      return n
    })
  const clean = React.useMemo(() => norm(draft), [draft])
  const dirty = !same(clean, pub)
  const wsum = PARTS.reduce((a, k) => a + draft.weights[k], 0) || 1

  const before = React.useMemo(() => preview(samples, pub), [samples, pub])
  const after = React.useMemo(() => preview(samples, clean), [samples, clean])

  async function call(method: "PUT" | "DELETE", body?: unknown) {
    setBusy(true)
    setMsg(null)
    const res = await fetch("/api/admin/config/scoring", {
      method,
      headers: { "Content-Type": "application/json" },
      body: body ? JSON.stringify(body) : undefined,
    }).catch(() => null)
    const json = res ? await res.json().catch(() => ({})) : {}
    setBusy(false)
    if (res?.ok) {
      setMsg({ ok: true, text: method === "PUT" ? "Publicado. Los análisis nuevos usan estas reglas." : "Restablecido a los valores por defecto." })
      setNote("")
      router.refresh()
      return true
    }
    setMsg({ ok: false, text: json.error ?? "No se pudo guardar." })
    return false
  }

  return (
    <div className="grid gap-6 xl:grid-cols-[1fr_22rem]">
      <div className="flex min-w-0 flex-col gap-6">
        <Card title="Peso de cada señal" hint="Se normaliza solo: lo que importa es la proporción. Si falta una señal en un negocio, se calcula con las demás.">
          <div className="grid grid-cols-2 gap-4 sm:grid-cols-5">
            {PARTS.map((k) => (
              <div key={k} className="flex flex-col gap-1.5">
                <Num label={PART_LABEL[k]} value={draft.weights[k]} min={0} max={100} onChange={(n) => edit((d) => void (d.weights[k] = n))} />
                <span className="text-xs text-muted-foreground tnum">{Math.round((draft.weights[k] / wsum) * 100)}% del total</span>
              </div>
            ))}
          </div>
        </Card>

        <Card title="Niveles" hint="Desde qué puntaje un negocio es verde (bueno) o naranja (medio). Por debajo es rojo.">
          <div className="grid max-w-md grid-cols-2 gap-4">
            <Num label="Verde desde" value={draft.tiers.good} min={1} max={100} onChange={(n) => edit((d) => void (d.tiers.good = n))} />
            <Num label="Naranja desde" value={draft.tiers.medium} min={0} max={100} onChange={(n) => edit((d) => void (d.tiers.medium = n))} />
          </div>
        </Card>

        <Card title="Reputación (Google)" hint="Promedio bayesiano: un 5.0 con pocas reseñas no vale como un 4.8 con miles.">
          <div className="grid grid-cols-2 gap-4 sm:grid-cols-3">
            <Num label="Rating supuesto sin reseñas" value={draft.reputation.priorMean} step={0.1} onChange={(n) => edit((d) => void (d.reputation.priorMean = n))} />
            <Num label="Reseñas que vale ese supuesto" value={draft.reputation.priorWeight} onChange={(n) => edit((d) => void (d.reputation.priorWeight = n))} hint="Más alto = cuesta más salir del supuesto." />
            <Num label="Rating que da 0 puntos" value={draft.reputation.ratingFloor} step={0.1} onChange={(n) => edit((d) => void (d.reputation.ratingFloor = n))} hint="5.0 siempre da 100." />
            <Num label="Peso del rating (0–1)" value={draft.reputation.ratingShare} step={0.05} onChange={(n) => edit((d) => void (d.reputation.ratingShare = n))} hint="El resto es volumen de reseñas." />
            <Num label="Reseñas para volumen completo" value={draft.reputation.volumeFull} onChange={(n) => edit((d) => void (d.reputation.volumeFull = n))} hint="Escala logarítmica." />
          </div>
        </Card>

        <Card title="Engagement" hint="Se compara con lo esperable para el tamaño de la cuenta: las cuentas grandes siempre tienen menos.">
          <div className="flex flex-col gap-5">
            <div className="flex flex-col gap-2">
              <span className="text-sm font-medium">Engagement esperado por tamaño de cuenta</span>
              {draft.engagement.expectedByFollowers.map((row, i, arr) => {
                const last = i === arr.length - 1
                return (
                  <div key={i} className="grid grid-cols-[1fr_1fr_2rem] items-end gap-3">
                    {last ? (
                      <div className="flex flex-col gap-1 text-sm">
                        <span className="text-xs text-muted-foreground">Seguidores hasta</span>
                        <span className="flex h-9 items-center text-muted-foreground">sin tope</span>
                      </div>
                    ) : (
                      <label className="flex flex-col gap-1 text-sm">
                        <span className="text-xs text-muted-foreground">Seguidores hasta</span>
                        <input className={inputCls} type="number" value={row.upTo} onChange={(e) => edit((d) => void (d.engagement.expectedByFollowers[i].upTo = Number(e.target.value) || 1))} />
                      </label>
                    )}
                    <label className="flex flex-col gap-1 text-sm">
                      <span className="text-xs text-muted-foreground">Engagement esperado (%)</span>
                      <input className={inputCls} type="number" step={0.1} value={row.expected} onChange={(e) => edit((d) => void (d.engagement.expectedByFollowers[i].expected = Number(e.target.value) || 0.1))} />
                    </label>
                    <Button variant="ghost" size="icon-sm" aria-label="Quitar fila" disabled={arr.length <= 2 || last} onClick={() => edit((d) => void d.engagement.expectedByFollowers.splice(i, 1))}>
                      ×
                    </Button>
                  </div>
                )
              })}
              <Button variant="outline" size="sm" className="w-fit" onClick={() => edit((d) => void d.engagement.expectedByFollowers.splice(d.engagement.expectedByFollowers.length - 1, 0, { upTo: 50_000, expected: 2.5 }))}>
                Añadir tramo
              </Button>
            </div>
            <div className="grid grid-cols-2 gap-4 sm:grid-cols-4">
              {NETS.map((n) => (
                <Num key={n} label={`Factor ${n === "instagram" ? "Instagram" : n === "tiktok" ? "TikTok" : n === "facebook" ? "Facebook" : "YouTube"}`} value={draft.engagement.networkFactor[n]} step={0.05} onChange={(v) => edit((d) => void (d.engagement.networkFactor[n] = v))} hint={n === "instagram" ? "Referencia = 1." : undefined} />
              ))}
            </div>
            <div className="grid grid-cols-2 gap-4 sm:grid-cols-3">
              <Num label="Múltiplo que da 100" value={draft.engagement.fullRatio} step={0.1} onChange={(n) => edit((d) => void (d.engagement.fullRatio = n))} hint="1.0× lo esperable da ~67." />
              <Num label="Peso de las vistas (0–1)" value={draft.engagement.viewsShare} step={0.05} onChange={(n) => edit((d) => void (d.engagement.viewsShare = n))} />
              <Num label="Vistas/seguidores que da 100" value={draft.engagement.viewsFull} step={0.05} onChange={(n) => edit((d) => void (d.engagement.viewsFull = n))} />
            </div>
          </div>
        </Card>

        <Card title="Actividad" hint="Mezcla la frecuencia de publicación con lo reciente que es el último post.">
          <div className="flex flex-col gap-5">
            <div className="grid grid-cols-2 gap-4 sm:grid-cols-3">
              <Num label="Posts por semana que da 100" value={draft.activity.postsPerWeekFull} step={0.5} onChange={(n) => edit((d) => void (d.activity.postsPerWeekFull = n))} />
              <Num label="Peso de la frecuencia (0–1)" value={draft.activity.frequencyShare} step={0.05} onChange={(n) => edit((d) => void (d.activity.frequencyShare = n))} hint="El resto es recencia." />
            </div>
            <div className="flex flex-col gap-2">
              <span className="text-sm font-medium">Días desde el último post → puntos</span>
              {draft.activity.recency.map((row, i, arr) => (
                <div key={i} className="grid grid-cols-[1fr_1fr_2rem] items-end gap-3">
                  <label className="flex flex-col gap-1 text-sm">
                    <span className="text-xs text-muted-foreground">Hasta (días)</span>
                    <input className={inputCls} type="number" value={row.days} onChange={(e) => edit((d) => void (d.activity.recency[i].days = Number(e.target.value) || 0))} />
                  </label>
                  <label className="flex flex-col gap-1 text-sm">
                    <span className="text-xs text-muted-foreground">Puntos (0–100)</span>
                    <input className={inputCls} type="number" value={row.score} onChange={(e) => edit((d) => void (d.activity.recency[i].score = Number(e.target.value) || 0))} />
                  </label>
                  <Button variant="ghost" size="icon-sm" aria-label="Quitar fila" disabled={arr.length <= 1} onClick={() => edit((d) => void d.activity.recency.splice(i, 1))}>
                    ×
                  </Button>
                </div>
              ))}
              <p className="text-xs text-muted-foreground">Más viejo que el último tramo da 0.</p>
              <Button variant="outline" size="sm" className="w-fit" onClick={() => edit((d) => void d.activity.recency.push({ days: 60, score: 5 }))}>
                Añadir tramo
              </Button>
            </div>
          </div>
        </Card>

        <div className="grid gap-6 md:grid-cols-2">
          <Card title="Audiencia" hint="Seguidores totales en todas las redes, en escala logarítmica.">
            <div className="grid grid-cols-2 gap-4">
              <Num label="Seguidores = 0 puntos" value={draft.audience.followersFloor} onChange={(n) => edit((d) => void (d.audience.followersFloor = n))} />
              <Num label="Seguidores = 100 puntos" value={draft.audience.followersFull} onChange={(n) => edit((d) => void (d.audience.followersFull = n))} />
            </div>
          </Card>
          <Card title="Presencia" hint="Cuántas redes tienen un post reciente.">
            <div className="grid grid-cols-2 gap-4">
              <Num label="Activa si posteó en (días)" value={draft.presence.activeDays} onChange={(n) => edit((d) => void (d.presence.activeDays = n))} />
              <Num label="Redes activas = 100" value={draft.presence.networksFull} min={1} max={4} onChange={(n) => edit((d) => void (d.presence.networksFull = n))} />
            </div>
          </Card>
        </div>

        <Card title="Confianza" hint="Cuándo el puntaje se marca como provisional.">
          <div className="grid grid-cols-3 gap-4">
            <Num label="Mín. posts de muestra" value={draft.confidence.minPostsSample} onChange={(n) => edit((d) => void (d.confidence.minPostsSample = n))} />
            <Num label="Alta desde (0–1)" value={draft.confidence.high} step={0.05} onChange={(n) => edit((d) => void (d.confidence.high = n))} />
            <Num label="Media desde (0–1)" value={draft.confidence.medium} step={0.05} onChange={(n) => edit((d) => void (d.confidence.medium = n))} />
          </div>
        </Card>
      </div>

      <aside className="flex flex-col gap-6 xl:sticky xl:top-6 xl:self-start">
        <Card title="Publicar" hint={custom ? `Reglas personalizadas${updatedAt ? ` · ${new Date(updatedAt).toLocaleString("es")}` : ""}${updatedBy ? ` · ${updatedBy}` : ""}` : "Hoy se usan los valores por defecto."}>
          <div className="flex flex-col gap-3">
            <input className={inputCls} placeholder="Nota del cambio (opcional)" value={note} maxLength={200} onChange={(e) => setNote(e.target.value)} />
            <Button disabled={!dirty || busy} onClick={() => void call("PUT", { value: serializeScoreConfig(clean), note })}>
              {busy ? "Guardando…" : dirty ? "Publicar reglas" : "Sin cambios"}
            </Button>
            <div className="flex gap-2">
              <Button variant="outline" size="sm" disabled={!dirty || busy} onClick={() => setDraft(clone(pub))}>
                Descartar
              </Button>
              <Button
                variant="ghost"
                size="sm"
                disabled={busy || (!custom && same(clean, def))}
                onClick={async () => {
                  if (!window.confirm("¿Restablecer todas las reglas a los valores por defecto?")) return
                  if (await call("DELETE")) setDraft(clone(def))
                }}
              >
                Valores por defecto
              </Button>
            </div>
            {msg ? (
              <p role={msg.ok ? "status" : "alert"} className={`text-sm ${msg.ok ? "text-positive" : "text-destructive"}`}>
                {msg.text}
              </p>
            ) : null}
          </div>
        </Card>

        <Card title="Vista previa" hint={samples.length ? "Los últimos análisis, con las reglas publicadas y con tus cambios." : undefined}>
          {samples.length ? (
            <ul className="flex flex-col divide-y">
              {samples.map((s, i) => {
                const b = before[i]
                const a = after[i]
                const delta = a?.score != null && b?.score != null ? a.score - b.score : null
                return (
                  <li key={s.id} className="flex items-center justify-between gap-3 py-2.5 text-sm first:pt-0 last:pb-0">
                    <span className="min-w-0">
                      <span className="block truncate font-medium">{s.name}</span>
                      <span className="text-xs text-muted-foreground tnum">
                        puesto {b?.rank ?? "—"}
                        {a && b && a.rank !== b.rank ? ` → ${a.rank}` : ""}
                      </span>
                    </span>
                    <span className="flex shrink-0 items-center gap-2 tnum">
                      <span className="text-muted-foreground">{b?.score ?? "—"}</span>
                      <span aria-hidden="true">→</span>
                      <span className="flex items-center gap-1.5 font-medium">
                        {a ? <span className="inline-block size-2 rounded-full" style={{ background: TIER_VAR[a.tier] }} aria-hidden="true" /> : null}
                        {a?.score ?? "—"}
                      </span>
                      {delta !== null && delta !== 0 ? <span className={`w-8 text-right text-xs ${delta > 0 ? "text-positive" : "text-brand"}`}>{delta > 0 ? `+${delta}` : `−${Math.abs(delta)}`}</span> : <span className="w-8" />}
                    </span>
                  </li>
                )
              })}
            </ul>
          ) : (
            <p className="text-sm text-muted-foreground text-pretty">Aún no hay análisis guardados. Haz uno en la app para ver aquí cómo cambiarían los puntajes.</p>
          )}
        </Card>

        {history.length ? (
          <Card title="Historial">
            <ul className="flex flex-col divide-y">
              {history.map((h) => (
                <li key={h.id} className="flex items-center justify-between gap-2 py-2 text-xs first:pt-0 last:pb-0">
                  <span className="min-w-0">
                    <span className="block truncate">{h.note || "Cambio de reglas"}</span>
                    <span className="text-muted-foreground">
                      {new Date(h.at).toLocaleString("es", { dateStyle: "medium", timeStyle: "short" })}
                      {h.by ? ` · ${h.by}` : ""}
                    </span>
                  </span>
                  <Button variant="ghost" size="xs" onClick={() => setDraft(clone(norm(h.value)))}>
                    Cargar
                  </Button>
                </li>
              ))}
            </ul>
          </Card>
        ) : null}
      </aside>
    </div>
  )
}
