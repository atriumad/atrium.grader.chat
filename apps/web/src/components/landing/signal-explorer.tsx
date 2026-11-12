"use client"

import * as React from "react"

// The five signals as an interactive explainer: pick one, see a small picture of how it is judged.
// Arrow keys move between tabs. All numbers are examples.

const TABS = [
  { id: "engagement", n: "01", name: "Engagement", ask: "Do people react when you post?", d: "Likes, comments and views, judged against what is normal for an account your size. Big accounts always get less, so the bar moves with you." },
  { id: "reputation", n: "02", name: "Reputation", ask: "What do guests say on Google?", d: "Your rating and how many reviews back it up. Three five-star reviews do not outrank two thousand good ones." },
  { id: "activity", n: "03", name: "Activity", ask: "Are you showing up often?", d: "How often you post and how recently you last did. A quiet account tells guests the kitchen might be quiet too." },
  { id: "audience", n: "04", name: "Audience", ask: "How many people can you reach?", d: "The size of your following across the networks you use, on a scale where the jump from 1K to 10K matters as much as 10K to 100K." },
  { id: "presence", n: "05", name: "Presence", ask: "Where are you active?", d: "How many networks you are actually using, not just how many you signed up for." },
] as const

function Bar({ label, value, pct, color, mark }: { label: string; value: string; pct: number; color: string; mark?: number }) {
  return (
    <div className="w-full">
      <div className="mb-1.5 flex items-baseline justify-between text-sm">
        <span className="text-body">{label}</span>
        <span className="font-serif text-2xl leading-none tnum text-charcoal">{value}</span>
      </div>
      <div className="relative h-2 rounded-full bg-track">
        <div className="h-full rounded-full" style={{ width: `${pct}%`, background: color }} />
        {mark !== undefined ? <div className="absolute -top-1 h-4 w-0.5 rounded-full bg-charcoal" style={{ left: `${mark}%` }} /> : null}
      </div>
    </div>
  )
}

function Visual({ id }: { id: (typeof TABS)[number]["id"] }) {
  if (id === "engagement")
    return (
      <div className="flex w-full flex-col gap-5">
        <Bar label="Your posts" value="1.1%" pct={26} color="var(--health-poor)" mark={66} />
        <p className="text-xs text-muted-foreground">The marker is the 3% an account your size is expected to reach. Below it, the bar is short.</p>
      </div>
    )
  if (id === "reputation")
    return (
      <div className="grid w-full grid-cols-2 gap-3">
        {[
          { s: "5.0", r: "3 reviews", w: "Counts little", tone: "bg-track-soft" },
          { s: "4.7", r: "2,000 reviews", w: "Counts a lot", tone: "bg-green-soft" },
        ].map((c) => (
          <div key={c.s} className={`rounded-[var(--radius-md)] p-4 text-center ${c.tone}`}>
            <p className="font-serif text-5xl leading-none tnum text-charcoal">{c.s}<span className="text-2xl">★</span></p>
            <p className="mt-2 text-sm text-body">{c.r}</p>
            <p className="mt-1 text-xs font-medium text-charcoal">{c.w}</p>
          </div>
        ))}
      </div>
    )
  if (id === "activity") {
    const posted = new Set([2, 4, 9, 11, 16, 18, 23])
    return (
      <div className="flex w-full flex-col items-center gap-3">
        <div className="grid grid-cols-14 gap-1.5" style={{ gridTemplateColumns: "repeat(14, minmax(0, 1fr))" }} aria-hidden="true">
          {Array.from({ length: 28 }, (_, i) => (
            <span key={i} className={`aspect-square rounded-[4px] ${posted.has(i) ? "bg-green-fill" : "bg-track"}`} />
          ))}
        </div>
        <p className="text-xs text-muted-foreground">Last 28 days: 7 posts, the last one 4 days ago.</p>
      </div>
    )
  }
  if (id === "audience")
    return (
      <div className="w-full">
        <div className="relative mt-6 h-2 rounded-full bg-track">
          <div className="absolute h-2 rounded-full bg-green-fill/35" style={{ left: "0%", width: "100%" }} />
          {[{ l: 1.1, p: 18, t: "You · 1.1K" }, { l: 8.9, p: 45, t: "Next door · 8.9K" }].map((m) => (
            <div key={m.t} className="absolute -top-2.5 -translate-x-1/2" style={{ left: `${m.p}%` }}>
              <span className="block size-6 rounded-full border-2 border-card bg-ink" />
              <span className="absolute top-8 left-1/2 -translate-x-1/2 text-xs whitespace-nowrap text-body">{m.t}</span>
            </div>
          ))}
        </div>
        <div className="mt-12 flex justify-between text-xs text-muted-foreground"><span>1K</span><span>10K</span><span>100K</span></div>
      </div>
    )
  return (
    <div className="grid w-full grid-cols-2 gap-3 sm:grid-cols-4">
      {[{ n: "Instagram", on: true }, { n: "Facebook", on: true }, { n: "TikTok", on: false }, { n: "YouTube", on: false }].map((c) => (
        <div key={c.n} className={`rounded-[var(--radius-md)] border p-3 text-center ${c.on ? "bg-green-soft" : "bg-card"}`}>
          <span className={`mx-auto block size-2.5 rounded-full ${c.on ? "bg-green-fill" : "border-2 border-pending"}`} />
          <p className="mt-2 text-sm text-charcoal">{c.n}</p>
          <p className="text-xs text-muted-foreground">{c.on ? "Active" : "Not in use"}</p>
        </div>
      ))}
    </div>
  )
}

export function SignalExplorer() {
  const [i, setI] = React.useState(0)
  const refs = React.useRef<Array<HTMLButtonElement | null>>([])
  const t = TABS[i]
  const move = (to: number) => {
    const next = (to + TABS.length) % TABS.length
    setI(next)
    refs.current[next]?.focus()
  }
  return (
    <div className="mx-auto mt-12 w-full max-w-3xl">
      <div role="tablist" aria-label="The five signals" className="flex flex-wrap justify-center gap-2">
        {TABS.map((x, idx) => (
          <button
            key={x.id}
            ref={(el) => {
              refs.current[idx] = el
            }}
            role="tab"
            id={`tab-${x.id}`}
            aria-selected={idx === i}
            aria-controls="signal-panel"
            tabIndex={idx === i ? 0 : -1}
            onClick={() => setI(idx)}
            onKeyDown={(e) => {
              if (e.key === "ArrowRight") move(i + 1)
              else if (e.key === "ArrowLeft") move(i - 1)
              else if (e.key === "Home") move(0)
              else if (e.key === "End") move(TABS.length - 1)
              else return
              e.preventDefault()
            }}
            className={`inline-flex items-center gap-2 rounded-full border px-4 py-2 text-sm transition-colors duration-200 ${idx === i ? "border-ink bg-ink text-lime" : "bg-card text-body hover:bg-track-soft"}`}
          >
            <span className="font-serif text-base tnum">{x.n}</span>
            {x.name}
          </button>
        ))}
      </div>

      <div id="signal-panel" role="tabpanel" aria-labelledby={`tab-${t.id}`} key={t.id} className="panel-in mt-6 rounded-[var(--radius-card)] border bg-card p-7 text-center shadow-[var(--shadow-rest)] sm:p-10">
        <p className="font-serif text-7xl leading-none text-muted-soft tnum">{t.n}</p>
        <h3 className="font-display mt-4 text-3xl leading-tight sm:text-4xl">{t.ask}</h3>
        <p className="type-body mx-auto mt-4 text-muted-foreground">{t.d}</p>
        <div className="mx-auto mt-8 flex max-w-md justify-center rounded-[var(--radius-card-sm)] bg-off-white p-5">
          <Visual id={t.id} />
        </div>
        <p className="mt-4 text-xs text-muted-foreground">Example values.</p>
      </div>
    </div>
  )
}
