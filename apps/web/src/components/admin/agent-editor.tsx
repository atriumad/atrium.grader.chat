"use client"

import * as React from "react"
import { useRouter } from "next/navigation"

import { Button } from "@/components/ui/button"
import { Card, inputCls, textareaCls } from "@/components/admin/ui"
import { DEFAULT_AGENT_CONFIG, sanitizeAgentConfig, type AgentConfig } from "@/lib/admin/agent-config"
import { TONE_LABEL, type Tone } from "@/lib/admin/tone"

type Hist = { id: number; value: unknown; note: string | null; at: string; by: string | null }

const TOOLS: Array<{ key: keyof AgentConfig["tools"]; label: string; hint: string; costly?: boolean }> = [
  { key: "liveSocial", label: "Redes sociales en vivo", hint: "Verifica seguidores y engagement actuales (Instagram, Facebook, TikTok, YouTube).", costly: true },
  { key: "liveGoogle", label: "Google Maps en vivo", hint: "Rating y reseñas actuales de la ficha." },
  { key: "seo", label: "SEO del sitio web", hint: "Revisa title, meta, datos estructurados, móvil, sitemap y velocidad de respuesta de la portada." },
  { key: "ranking", label: "Ranking en Google", hint: "Busca una consulta típica de cliente y dice en qué posición sale el negocio.", costly: true },
  { key: "knowledge", label: "Base de conocimiento", hint: "Busca en el material que subes en la sección Conocimiento." },
  { key: "booking", label: "Agendar reuniones", hint: "Muestra horarios libres y propone la reunión con el equipo." },
]

const same = (a: AgentConfig, b: AgentConfig) => JSON.stringify(a) === JSON.stringify(b)

export function AgentEditor({ initial, custom, updatedAt, updatedBy, history }: { initial: AgentConfig; custom: boolean; updatedAt: string | null; updatedBy: string | null; history: Hist[] }) {
  const router = useRouter()
  const saved = React.useMemo(() => sanitizeAgentConfig(initial), [initial])
  const [draft, setDraft] = React.useState<AgentConfig>(saved)
  const [note, setNote] = React.useState("")
  const [busy, setBusy] = React.useState(false)
  const [msg, setMsg] = React.useState<{ ok: boolean; text: string } | null>(null)
  const dirty = !same(sanitizeAgentConfig(draft), saved)

  async function call(method: "PUT" | "DELETE") {
    setBusy(true)
    setMsg(null)
    const res = await fetch("/api/admin/config/agent", {
      method,
      headers: { "Content-Type": "application/json" },
      body: method === "PUT" ? JSON.stringify({ value: draft, note }) : undefined,
    }).catch(() => null)
    const json = res ? await res.json().catch(() => ({})) : {}
    setBusy(false)
    if (res?.ok) {
      setMsg({ ok: true, text: method === "PUT" ? "Publicado. Aplica a las conversaciones nuevas." : "Restablecido a los valores por defecto." })
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
        <Card title="Tono" hint="Cómo habla el agente con el usuario. Aplica al análisis escrito y al chat.">
          <div role="radiogroup" aria-label="Tono" className="flex flex-wrap gap-2">
            {(Object.keys(TONE_LABEL) as Tone[]).map((t) => (
              <button
                key={t}
                type="button"
                role="radio"
                aria-checked={draft.tone === t}
                onClick={() => setDraft({ ...draft, tone: t })}
                className={`rounded-full border px-3.5 py-1.5 text-sm transition-colors ${draft.tone === t ? "border-foreground bg-foreground text-primary-foreground" : "bg-card hover:bg-secondary"}`}
              >
                {TONE_LABEL[t]}
              </button>
            ))}
          </div>
        </Card>

        <Card title="Instrucciones del chat" hint="Reglas adicionales para el asistente que responde preguntas. No reemplazan las reglas de seguridad ni los datos del negocio. Ej.: 'Si preguntan por precios, ofrece una llamada y no des cifras'.">
          <textarea className={textareaCls} rows={6} maxLength={4000} value={draft.chatInstructions} onChange={(e) => setDraft({ ...draft, chatInstructions: e.target.value })} placeholder="Sin instrucciones adicionales" />
          <p className="mt-1 text-right text-xs text-muted-foreground tnum">{draft.chatInstructions.length}/4000</p>
        </Card>

        <Card title="Instrucciones del análisis" hint="Reglas adicionales para el texto del diagnóstico. No cambian las tres secciones del reporte ni el puntaje.">
          <textarea className={textareaCls} rows={6} maxLength={4000} value={draft.analysisInstructions} onChange={(e) => setDraft({ ...draft, analysisInstructions: e.target.value })} placeholder="Sin instrucciones adicionales" />
          <p className="mt-1 text-right text-xs text-muted-foreground tnum">{draft.analysisInstructions.length}/4000</p>
        </Card>

        <Card title="Herramientas del chat" hint="Qué puede consultar o hacer el agente por su cuenta. Las marcadas consumen créditos de ScrapeCreators.">
          <ul className="flex flex-col divide-y">
            {TOOLS.map((t) => (
              <li key={t.key} className="py-3 first:pt-0 last:pb-0">
                <label className="flex cursor-pointer items-start gap-3">
                  <input type="checkbox" className="mt-1 size-4 accent-[var(--brand)]" checked={draft.tools[t.key]} onChange={(e) => setDraft({ ...draft, tools: { ...draft.tools, [t.key]: e.target.checked } })} />
                  <span className="flex flex-col gap-0.5 text-sm">
                    <span className="font-medium">
                      {t.label}
                      {t.costly ? <span className="ml-2 rounded-full bg-secondary px-2 py-0.5 text-[0.6875rem] font-normal text-muted-foreground">consume créditos</span> : null}
                    </span>
                    <span className="text-muted-foreground text-pretty">{t.hint}</span>
                  </span>
                </label>
              </li>
            ))}
          </ul>
          <div className="mt-4 max-w-48">
            <label className="flex flex-col gap-1 text-sm">
              <span className="font-medium">Máx. rondas de herramientas</span>
              <input type="number" min={2} max={12} className={inputCls} value={draft.maxToolRounds} onChange={(e) => setDraft({ ...draft, maxToolRounds: Number(e.target.value) || 8 })} />
              <span className="text-xs text-muted-foreground">Tope de consultas encadenadas por respuesta (2–12).</span>
            </label>
          </div>
        </Card>
      </div>

      <aside className="flex flex-col gap-6 xl:sticky xl:top-6 xl:self-start">
        <Card title="Publicar" hint={custom ? `Configuración personalizada${updatedAt ? ` · ${new Date(updatedAt).toLocaleString("es")}` : ""}${updatedBy ? ` · ${updatedBy}` : ""}` : "Hoy se usa el comportamiento por defecto."}>
          <div className="flex flex-col gap-3">
            <input className={inputCls} placeholder="Nota del cambio (opcional)" value={note} maxLength={200} onChange={(e) => setNote(e.target.value)} />
            <Button disabled={!dirty || busy} onClick={() => void call("PUT")}>
              {busy ? "Guardando…" : dirty ? "Publicar cambios" : "Sin cambios"}
            </Button>
            <div className="flex gap-2">
              <Button variant="outline" size="sm" disabled={!dirty || busy} onClick={() => setDraft(saved)}>
                Descartar
              </Button>
              <Button
                variant="ghost"
                size="sm"
                disabled={busy || (!custom && same(sanitizeAgentConfig(draft), DEFAULT_AGENT_CONFIG))}
                onClick={async () => {
                  if (!window.confirm("¿Restablecer el comportamiento de los agentes a los valores por defecto?")) return
                  if (await call("DELETE")) setDraft(DEFAULT_AGENT_CONFIG)
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
        {history.length ? (
          <Card title="Historial">
            <ul className="flex flex-col divide-y">
              {history.map((h) => (
                <li key={h.id} className="flex items-center justify-between gap-2 py-2 text-xs first:pt-0 last:pb-0">
                  <span className="min-w-0">
                    <span className="block truncate">{h.note || "Cambio de configuración"}</span>
                    <span className="text-muted-foreground">
                      {new Date(h.at).toLocaleString("es", { dateStyle: "medium", timeStyle: "short" })}
                      {h.by ? ` · ${h.by}` : ""}
                    </span>
                  </span>
                  <Button variant="ghost" size="xs" onClick={() => setDraft(sanitizeAgentConfig(h.value))}>
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
