"use client"

import * as React from "react"

import { useInView } from "./use-in-view"

// Three steps on a centred line. Each node lights up, and the line to it draws, as it scrolls
// into view. Without motion preferences honoured it simply shows every step lit.

const STEPS = [
  { t: "Find your restaurant", d: "Type its name and pick it from the Google Maps suggestions. An Instagram @handle works too." },
  { t: "We read the public data", d: "Your Google listing, the places of the same type within about two miles, and everyone's public social profiles. You watch each step happen." },
  { t: "Get your score and a plan", d: "Your Atrium Score, a map of the competition and a written analysis with the actions that matter most. Then ask questions or book a 30-minute call." },
]

function Step({ n, t, d, first }: { n: number; t: string; d: string; first: boolean }) {
  const [ref, on] = useInView<HTMLLIElement>(0.5)
  return (
    <li ref={ref} className="relative flex flex-col items-center text-center">
      {first ? null : (
        <span aria-hidden="true" className="relative block h-16 w-px bg-[var(--line)] sm:h-20">
          <span className="absolute inset-0 origin-top bg-green-fill transition-transform duration-[900ms] ease-[cubic-bezier(0.22,0.61,0.36,1)]" style={{ transform: on ? "scaleY(1)" : "scaleY(0)" }} />
        </span>
      )}
      <span
        className={`grid size-14 place-items-center rounded-full border-2 font-serif text-3xl leading-none tnum transition-colors duration-500 ${on ? "border-ink bg-ink text-lime" : "border-[var(--line)] bg-card text-muted-soft"}`}
        style={{ transitionDelay: first ? "0ms" : "500ms" }}
      >
        {n}
      </span>
      <h3 className="font-display mt-5 text-2xl sm:text-3xl">{t}</h3>
      <p className="type-body mt-2 max-w-[48ch] text-muted-foreground">{d}</p>
    </li>
  )
}

export function StepsTimeline() {
  return (
    <ol className="mx-auto mt-14 flex w-full max-w-2xl flex-col items-center">
      {STEPS.map((s, i) => (
        <Step key={s.t} n={i + 1} t={s.t} d={s.d} first={i === 0} />
      ))}
    </ol>
  )
}
