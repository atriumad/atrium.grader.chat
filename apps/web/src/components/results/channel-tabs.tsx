"use client"

import * as React from "react"

import type { Dataset } from "@/lib/analysis"
import { channelsOf, fmt, type ChannelNetwork } from "@/lib/metrics"

const NETWORK_LABEL: Record<ChannelNetwork | "google", string> = {
  google: "Google",
  instagram: "Instagram",
  facebook: "Facebook",
  tiktok: "TikTok",
  youtube: "YouTube",
}

type Stat = { label: string; value: string | null }

// A missing value reads "sin dato", never a silent zero: the owner sees what could not be read.
function Stats({ stats }: { stats: Stat[] }) {
  return (
    <dl className="grid grid-cols-2 gap-px overflow-hidden rounded-xl border bg-border sm:grid-cols-4">
      {stats.map((s) => (
        <div key={s.label} className="flex flex-col gap-1 bg-card px-4 py-3">
          <dt className="text-xs text-muted-foreground">{s.label}</dt>
          <dd className={`font-display text-2xl leading-none tnum ${s.value === null ? "text-muted-foreground" : ""}`}>{s.value ?? "sin dato"}</dd>
        </div>
      ))}
    </dl>
  )
}

export function ChannelTabs({ data }: { data: Dataset }) {
  const you = data.business
  const channels = channelsOf(you)
  const tabs: Array<ChannelNetwork | "google"> = ["google", ...channels.map((c) => c.network)]
  const [tab, setTab] = React.useState<ChannelNetwork | "google">("google")
  const current = channels.find((c) => c.network === tab)
  const notes = [you.instagramNote !== "ok" ? you.instagramNote : "", you.networksNote ?? ""].filter(Boolean)

  return (
    <section aria-label="Detalle por canal" className="overflow-hidden rounded-2xl border bg-card">
      <div role="tablist" aria-label="Canales" className="flex gap-1 overflow-x-auto border-b px-3 py-2 [scrollbar-width:none] [&::-webkit-scrollbar]:hidden">
        {tabs.map((t) => (
          <button
            key={t}
            id={`tab-${t}`}
            type="button"
            role="tab"
            aria-selected={tab === t}
            aria-controls="channel-panel"
            onClick={() => setTab(t)}
            className={`shrink-0 rounded-full px-3 py-1.5 text-sm transition-colors ${tab === t ? "bg-foreground text-primary-foreground" : "text-muted-foreground hover:bg-secondary hover:text-foreground"}`}
          >
            {NETWORK_LABEL[t]}
          </button>
        ))}
      </div>
      <div id="channel-panel" role="tabpanel" aria-labelledby={`tab-${tab}`} className="flex flex-col gap-3 p-4 sm:p-5">
        {tab === "google" ? (
          you.place ? (
            <>
              <p className="text-sm text-muted-foreground">{you.place.address}</p>
              <Stats
                stats={[
                  { label: "Rating", value: you.place.rating != null ? fmt.rating(you.place.rating) : null },
                  { label: "Reseñas", value: you.place.reviews != null ? String(you.place.reviews) : null },
                ]}
              />
            </>
          ) : (
            <p className="text-sm text-muted-foreground">No se confirmó una ficha de Google para este negocio, así que la reputación no cuenta en el puntaje.</p>
          )
        ) : current ? (
          <>
            <p className="text-sm text-muted-foreground">@{current.handle} · {current.postsSampled} posts públicos analizados</p>
            <Stats
              stats={[
                { label: "Seguidores", value: current.followers != null ? fmt.followers(current.followers) : null },
                { label: "Interacción", value: current.engagementRatePct != null ? fmt.engagement(current.engagementRatePct) : null },
                { label: "Posts por semana", value: current.postsPerWeek != null ? fmt.postsPerWeek(current.postsPerWeek) : null },
                { label: "Último post", value: current.lastPostDaysAgo != null ? `hace ${current.lastPostDaysAgo} d` : null },
              ]}
            />
          </>
        ) : null}
        {notes.length > 0 ? <p className="text-xs text-muted-foreground">{notes.join(" · ")}</p> : null}
      </div>
    </section>
  )
}
