"use client"

import { CountUp } from "./count-up"
import { useInView } from "./use-in-view"

// A small, static version of the report built from sample data: the ink score panel, the ranking
// with health bars and the "what holds you back" callout. Rings draw and numbers count on reveal.

const RANK = [
  { n: 1, name: "Casa Lucía", score: 79, tone: "good", word: "Strong" },
  { n: 2, name: "Brasa & Co.", score: 72, tone: "good", word: "Strong" },
  { n: 3, name: "Your restaurant", score: 43, tone: "poor", word: "Room to grow", you: true },
] as const
const FILL = { good: "var(--health-good)", fair: "var(--health-fair)", poor: "var(--health-poor)" }

function Ring({ score, on }: { score: number; on: boolean }) {
  const r = 52
  const c = 2 * Math.PI * r
  return (
    <svg viewBox="0 0 132 132" className="size-36 shrink-0 -rotate-90 sm:size-40" aria-hidden="true">
      <circle cx="66" cy="66" r={r} fill="none" stroke="var(--line-inverse)" strokeWidth="9" />
      <circle
        cx="66"
        cy="66"
        r={r}
        fill="none"
        stroke="var(--health-poor)"
        strokeWidth="9"
        strokeLinecap="round"
        strokeDasharray={c}
        strokeDashoffset={on ? c * (1 - score / 100) : c}
        style={{ transition: "stroke-dashoffset 1500ms cubic-bezier(0.22, 0.61, 0.36, 1) 140ms" }}
      />
    </svg>
  )
}

export function ReportPeek() {
  const [ref, on] = useInView<HTMLDivElement>(0.3)
  return (
    <div ref={ref} className="grid gap-4 lg:grid-cols-[minmax(0,1.05fr)_minmax(0,0.95fr)]">
      <div className="flex flex-col gap-4">
        <div className="flex items-center gap-6 rounded-[var(--radius-card)] bg-ink p-6 text-cream sm:p-8">
          <div className="relative grid shrink-0 place-items-center">
            <Ring score={43} on={on} />
            <div className="absolute text-center">
              <CountUp value={43} className="font-serif text-6xl leading-none text-lime" />
              <p className="mt-1 text-xs text-cream/70">of 100</p>
            </div>
          </div>
          <div className="min-w-0">
            <p className="type-eyebrow text-lime">Atrium Score</p>
            <p className="font-display mt-3 text-2xl leading-tight sm:text-3xl">
              You rank 3rd of 3 in your area: 33 points <em>below your competitors.</em>
            </p>
          </div>
        </div>
        <div className="rounded-[var(--radius-card-sm)] bg-amber-soft p-5">
          <p className="type-eyebrow text-amber-ink">What holds you back most</p>
          <p className="mt-2 text-sm/relaxed text-charcoal">
            <strong className="font-semibold">Engagement.</strong> Followers are not reacting to your posts as much as they do for the places next door. That is the first thing to fix, and the report says how.
          </p>
        </div>
      </div>

      <div className="rounded-[var(--radius-card-sm)] border bg-card p-5 shadow-[var(--shadow-rest)] sm:p-6">
        <p className="type-eyebrow text-muted-foreground">Competitors in your area</p>
        <ul className="mt-4 flex flex-col divide-y">
          {RANK.map((r) => (
            <li key={r.n} className="flex items-center gap-3 py-3.5">
              <span className={`grid size-7 shrink-0 place-items-center rounded-full text-xs font-semibold ${"you" in r ? "bg-charcoal text-cream" : "bg-ink text-lime"}`}>{r.n}</span>
              <span className="min-w-0 flex-1">
                <span className="block truncate text-sm font-medium text-charcoal">{r.name}</span>
                <span className="block text-xs text-muted-foreground">{r.word}</span>
              </span>
              <span className="h-1.5 w-20 overflow-hidden rounded-full bg-track sm:w-28" aria-hidden="true">
                <span
                  className="block h-full origin-left rounded-full"
                  style={{ width: `${r.score}%`, background: FILL[r.tone], transform: on ? "scaleX(1)" : "scaleX(0)", transition: `transform 1000ms cubic-bezier(0.22, 0.61, 0.36, 1) ${300 + r.n * 120}ms` }}
                />
              </span>
              <span className="w-9 text-right font-serif text-2xl leading-none tnum text-charcoal">{r.score}</span>
            </li>
          ))}
        </ul>
        <p className="mt-4 text-xs text-muted-foreground">Sample data. Your report uses your real numbers.</p>
      </div>
    </div>
  )
}
