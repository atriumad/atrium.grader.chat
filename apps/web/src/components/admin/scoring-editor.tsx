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
      setMsg({ ok: true, text: method === "PUT" ? "Published. New analyses use these rules." : "Reset to the default values." })
      setNote("")
      router.refresh()
      return true
    }
    setMsg({ ok: false, text: json.error ?? "Could not save." })
    return false
  }

  return (
    <div className="grid gap-6 xl:grid-cols-[1fr_22rem]">
      <div className="flex min-w-0 flex-col gap-6">
        <Card title="Weight of each signal" hint="It normalizes itself: only the proportion matters. If a signal is missing for a business, the score is calculated from the others.">
          <div className="grid grid-cols-2 gap-4 sm:grid-cols-5">
            {PARTS.map((k) => (
              <div key={k} className="flex flex-col gap-1.5">
                <Num label={PART_LABEL[k]} value={draft.weights[k]} min={0} max={100} onChange={(n) => edit((d) => void (d.weights[k] = n))} />
                <span className="text-xs text-muted-foreground tnum">{Math.round((draft.weights[k] / wsum) * 100)}% del total</span>
              </div>
            ))}
          </div>
        </Card>

        <Card title="Levels" hint="From what score a business is green (good) or orange (fair). Below that it is red.">
          <div className="grid max-w-md grid-cols-2 gap-4">
            <Num label="Green from" value={draft.tiers.good} min={1} max={100} onChange={(n) => edit((d) => void (d.tiers.good = n))} />
            <Num label="Orange from" value={draft.tiers.medium} min={0} max={100} onChange={(n) => edit((d) => void (d.tiers.medium = n))} />
          </div>
        </Card>

        <Card title="Reputation (Google)" hint="Bayesian average: a 5.0 with few reviews is not worth the same as a 4.8 with thousands.">
          <div className="grid grid-cols-2 gap-4 sm:grid-cols-3">
            <Num label="Assumed rating with no reviews" value={draft.reputation.priorMean} step={0.1} onChange={(n) => edit((d) => void (d.reputation.priorMean = n))} />
            <Num label="Reviews that assumption is worth" value={draft.reputation.priorWeight} onChange={(n) => edit((d) => void (d.reputation.priorWeight = n))} hint="Higher = harder to move away from the assumption." />
            <Num label="Rating that gives 0 points" value={draft.reputation.ratingFloor} step={0.1} onChange={(n) => edit((d) => void (d.reputation.ratingFloor = n))} hint="5.0 always gives 100." />
            <Num label="Rating weight (0–1)" value={draft.reputation.ratingShare} step={0.05} onChange={(n) => edit((d) => void (d.reputation.ratingShare = n))} hint="The rest is review volume." />
            <Num label="Reviews for full volume" value={draft.reputation.volumeFull} onChange={(n) => edit((d) => void (d.reputation.volumeFull = n))} hint="Logarithmic scale." />
          </div>
        </Card>

        <Card title="Engagement" hint="Compared with what is expected for the account size: large accounts always get less.">
          <div className="flex flex-col gap-5">
            <div className="flex flex-col gap-2">
              <span className="text-sm font-medium">Expected engagement by account size</span>
              {draft.engagement.expectedByFollowers.map((row, i, arr) => {
                const last = i === arr.length - 1
                return (
                  <div key={i} className="grid grid-cols-[1fr_1fr_2rem] items-end gap-3">
                    {last ? (
                      <div className="flex flex-col gap-1 text-sm">
                        <span className="text-xs text-muted-foreground">Followers up to</span>
                        <span className="flex h-9 items-center text-muted-foreground">no cap</span>
                      </div>
                    ) : (
                      <label className="flex flex-col gap-1 text-sm">
                        <span className="text-xs text-muted-foreground">Followers up to</span>
                        <input className={inputCls} type="number" value={row.upTo} onChange={(e) => edit((d) => void (d.engagement.expectedByFollowers[i].upTo = Number(e.target.value) || 1))} />
                      </label>
                    )}
                    <label className="flex flex-col gap-1 text-sm">
                      <span className="text-xs text-muted-foreground">Expected engagement (%)</span>
                      <input className={inputCls} type="number" step={0.1} value={row.expected} onChange={(e) => edit((d) => void (d.engagement.expectedByFollowers[i].expected = Number(e.target.value) || 0.1))} />
                    </label>
                    <Button variant="ghost" size="icon-sm" aria-label="Remove row" disabled={arr.length <= 2 || last} onClick={() => edit((d) => void d.engagement.expectedByFollowers.splice(i, 1))}>
                      ×
                    </Button>
                  </div>
                )
              })}
              <Button variant="outline" size="sm" className="w-fit" onClick={() => edit((d) => void d.engagement.expectedByFollowers.splice(d.engagement.expectedByFollowers.length - 1, 0, { upTo: 50_000, expected: 2.5 }))}>
                Add tier
              </Button>
            </div>
            <div className="grid grid-cols-2 gap-4 sm:grid-cols-4">
              {NETS.map((n) => (
                <Num key={n} label={`Factor ${n === "instagram" ? "Instagram" : n === "tiktok" ? "TikTok" : n === "facebook" ? "Facebook" : "YouTube"}`} value={draft.engagement.networkFactor[n]} step={0.05} onChange={(v) => edit((d) => void (d.engagement.networkFactor[n] = v))} hint={n === "instagram" ? "Referencia = 1." : undefined} />
              ))}
            </div>
            <div className="grid grid-cols-2 gap-4 sm:grid-cols-3">
              <Num label="Multiple that gives 100" value={draft.engagement.fullRatio} step={0.1} onChange={(n) => edit((d) => void (d.engagement.fullRatio = n))} hint="1.0× the expected gives ~67." />
              <Num label="Views weight (0–1)" value={draft.engagement.viewsShare} step={0.05} onChange={(n) => edit((d) => void (d.engagement.viewsShare = n))} />
              <Num label="Views/followers that gives 100" value={draft.engagement.viewsFull} step={0.05} onChange={(n) => edit((d) => void (d.engagement.viewsFull = n))} />
            </div>
          </div>
        </Card>

        <Card title="Activity" hint="Blends posting frequency with how recent the last post is.">
          <div className="flex flex-col gap-5">
            <div className="grid grid-cols-2 gap-4 sm:grid-cols-3">
              <Num label="Posts per week that gives 100" value={draft.activity.postsPerWeekFull} step={0.5} onChange={(n) => edit((d) => void (d.activity.postsPerWeekFull = n))} />
              <Num label="Frequency weight (0–1)" value={draft.activity.frequencyShare} step={0.05} onChange={(n) => edit((d) => void (d.activity.frequencyShare = n))} hint="The rest is recency." />
            </div>
            <div className="flex flex-col gap-2">
              <span className="text-sm font-medium">Days since the last post → points</span>
              {draft.activity.recency.map((row, i, arr) => (
                <div key={i} className="grid grid-cols-[1fr_1fr_2rem] items-end gap-3">
                  <label className="flex flex-col gap-1 text-sm">
                    <span className="text-xs text-muted-foreground">Up to (days)</span>
                    <input className={inputCls} type="number" value={row.days} onChange={(e) => edit((d) => void (d.activity.recency[i].days = Number(e.target.value) || 0))} />
                  </label>
                  <label className="flex flex-col gap-1 text-sm">
                    <span className="text-xs text-muted-foreground">Points (0–100)</span>
                    <input className={inputCls} type="number" value={row.score} onChange={(e) => edit((d) => void (d.activity.recency[i].score = Number(e.target.value) || 0))} />
                  </label>
                  <Button variant="ghost" size="icon-sm" aria-label="Remove row" disabled={arr.length <= 1} onClick={() => edit((d) => void d.activity.recency.splice(i, 1))}>
                    ×
                  </Button>
                </div>
              ))}
              <p className="text-xs text-muted-foreground">Older than the last tier gives 0.</p>
              <Button variant="outline" size="sm" className="w-fit" onClick={() => edit((d) => void d.activity.recency.push({ days: 60, score: 5 }))}>
                Add tier
              </Button>
            </div>
          </div>
        </Card>

        <div className="grid gap-6 md:grid-cols-2">
          <Card title="Audience" hint="Total followers across all networks, on a logarithmic scale.">
            <div className="grid grid-cols-2 gap-4">
              <Num label="Followers = 0 points" value={draft.audience.followersFloor} onChange={(n) => edit((d) => void (d.audience.followersFloor = n))} />
              <Num label="Followers = 100 points" value={draft.audience.followersFull} onChange={(n) => edit((d) => void (d.audience.followersFull = n))} />
            </div>
          </Card>
          <Card title="Presence" hint="How many networks have a recent post.">
            <div className="grid grid-cols-2 gap-4">
              <Num label="Active if posted within (days)" value={draft.presence.activeDays} onChange={(n) => edit((d) => void (d.presence.activeDays = n))} />
              <Num label="Active networks = 100" value={draft.presence.networksFull} min={1} max={4} onChange={(n) => edit((d) => void (d.presence.networksFull = n))} />
            </div>
          </Card>
        </div>

        <Card title="Confidence" hint="When the score is marked as provisional.">
          <div className="grid grid-cols-3 gap-4">
            <Num label="Min. sample posts" value={draft.confidence.minPostsSample} onChange={(n) => edit((d) => void (d.confidence.minPostsSample = n))} />
            <Num label="High from (0–1)" value={draft.confidence.high} step={0.05} onChange={(n) => edit((d) => void (d.confidence.high = n))} />
            <Num label="Medium from (0–1)" value={draft.confidence.medium} step={0.05} onChange={(n) => edit((d) => void (d.confidence.medium = n))} />
          </div>
        </Card>
      </div>

      <aside className="flex flex-col gap-6 xl:sticky xl:top-6 xl:self-start">
        <Card title="Publish" hint={custom ? `Custom rules${updatedAt ? ` · ${new Date(updatedAt).toLocaleString("en-US")}` : ""}${updatedBy ? ` · ${updatedBy}` : ""}` : "The default values are in use today."}>
          <div className="flex flex-col gap-3">
            <input className={inputCls} placeholder="Change note (optional)" value={note} maxLength={200} onChange={(e) => setNote(e.target.value)} />
            <Button disabled={!dirty || busy} onClick={() => void call("PUT", { value: serializeScoreConfig(clean), note })}>
              {busy ? "Saving…" : dirty ? "Publish rules" : "No changes"}
            </Button>
            <div className="flex gap-2">
              <Button variant="outline" size="sm" disabled={!dirty || busy} onClick={() => setDraft(clone(pub))}>
                Discard
              </Button>
              <Button
                variant="ghost"
                size="sm"
                disabled={busy || (!custom && same(clean, def))}
                onClick={async () => {
                  if (!window.confirm("Reset all rules to the default values?")) return
                  if (await call("DELETE")) setDraft(clone(def))
                }}
              >
                Defaults
              </Button>
            </div>
            {msg ? (
              <p role={msg.ok ? "status" : "alert"} className={`text-sm ${msg.ok ? "text-positive" : "text-destructive"}`}>
                {msg.text}
              </p>
            ) : null}
          </div>
        </Card>

        <Card title="Preview" hint={samples.length ? "The latest analyses, with the published rules and with your changes." : undefined}>
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
                        rank {b?.rank ?? "—"}
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
            <p className="text-sm text-muted-foreground text-pretty">No analyses saved yet. Run one in the app to see here how the scores would change.</p>
          )}
        </Card>

        {history.length ? (
          <Card title="History">
            <ul className="flex flex-col divide-y">
              {history.map((h) => (
                <li key={h.id} className="flex items-center justify-between gap-2 py-2 text-xs first:pt-0 last:pb-0">
                  <span className="min-w-0">
                    <span className="block truncate">{h.note || "Cambio de reglas"}</span>
                    <span className="text-muted-foreground">
                      {new Date(h.at).toLocaleString("en-US", { dateStyle: "medium", timeStyle: "short" })}
                      {h.by ? ` · ${h.by}` : ""}
                    </span>
                  </span>
                  <Button variant="ghost" size="xs" onClick={() => setDraft(clone(norm(h.value)))}>
                    Load
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
