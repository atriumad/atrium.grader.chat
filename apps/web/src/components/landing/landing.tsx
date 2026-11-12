import { Logo } from "@/components/brand/logo"
import { HomeJsonLd } from "@/components/seo/json-ld"
import { FAQ } from "@/lib/site"

import { FocusSearchButton } from "./focus-search"
import Image from "next/image"

import { ShotTour } from "./shot-tour"
import { Reveal } from "./reveal"

// The part of the home page under the search box. One idea per section, everything centred, one
// image. Server-rendered: it is what search engines read, so it stays factual.

const H2 = "font-display mx-auto max-w-[20ch] text-[clamp(2.25rem,5vw,4rem)] leading-[1]"
const SECTION = "mx-auto flex w-full max-w-[1000px] flex-col items-center px-4 py-[clamp(4rem,10vw,7rem)] text-center sm:px-6"

const SIGNALS = [
  { name: "Engagement", d: "Do people react when you post?" },
  { name: "Reputation", d: "What do guests say on Google?" },
  { name: "Activity", d: "Are you showing up often?" },
  { name: "Audience", d: "How many people can you reach?" },
  { name: "Presence", d: "Where are you active?" },
]

const STEPS = [
  { t: "Find your restaurant", d: "Type its name and pick it from the Google Maps suggestions." },
  { t: "We read the public data", d: "Your listing, the places around you and everyone's social profiles." },
  { t: "Get your score and a plan", d: "A map of the competition, a written analysis and the actions that matter most." },
]

export function Landing() {
  return (
    <>
      <HomeJsonLd />

      <section aria-labelledby="problem-h">
        <div className={SECTION}>
          <Reveal className="flex flex-col items-center gap-6">
            <h2 id="problem-h" className="font-display mx-auto max-w-[22ch] text-[clamp(2.25rem,5vw,4rem)] leading-[1]">
              <span className="text-muted-foreground">You know your restaurant.</span>
              <br />
              Now know <em>how it compares.</em>
            </h2>
            <p className="type-lead mx-auto text-body">Your guests check your Google stars, scroll your Instagram and look at the place next door before they ever walk in. The Grader does that comparison for you.</p>
          </Reveal>
        </div>
      </section>

      <section aria-labelledby="measure-h" className="bg-off-white">
        <div className={SECTION}>
          <Reveal className="flex flex-col items-center gap-6">
            <p className="type-eyebrow text-muted-foreground">What we measure</p>
            <h2 id="measure-h" className={H2}>
              Five signals. <em>One honest score.</em>
            </h2>
          </Reveal>
          <Reveal className="mt-12 w-full">
            <ul className="grid gap-x-8 gap-y-8 sm:grid-cols-5">
              {SIGNALS.map((s) => (
                <li key={s.name} className="flex flex-col items-center gap-2">
                  <span aria-hidden="true" className="size-2 rounded-full bg-green-fill" />
                  <h3 className="text-lg font-medium tracking-tight text-charcoal">{s.name}</h3>
                  <p className="text-sm text-muted-foreground">{s.d}</p>
                </li>
              ))}
            </ul>
          </Reveal>
        </div>
      </section>

      <section aria-labelledby="plan-h">
        <div className={SECTION}>
          <Reveal className="flex flex-col items-center gap-6">
            <p className="type-eyebrow text-muted-foreground">What you get</p>
            <h2 id="plan-h" className={H2}>
              A plan, <em>not just a number.</em>
            </h2>
            <p className="type-lead mx-auto text-body">A written analysis, the three actions that matter most and a direct line to the team.</p>
          </Reveal>
          <Reveal className="mt-12 w-full" delay={80}>
            <ShotTour tour="plan" alt="The written analysis of the report with the three actions that matter most and a button to book a meeting" />
          </Reveal>
        </div>
      </section>

      <section aria-labelledby="how-h" className="bg-off-white">
        <div className={SECTION}>
          <Reveal className="flex flex-col items-center gap-6">
            <p className="type-eyebrow text-muted-foreground">How it works</p>
            <h2 id="how-h" className={H2}>
              About 40 seconds, <em>start to finish.</em>
            </h2>
          </Reveal>
          <Reveal className="mt-12 w-full">
            <ol className="grid gap-x-10 gap-y-10 md:grid-cols-3">
              {STEPS.map((s, i) => (
                <li key={s.t} className="flex flex-col items-center gap-3">
                  <span className="font-serif text-6xl leading-none text-charcoal tnum">{i + 1}</span>
                  <h3 className="text-xl font-medium tracking-tight text-charcoal">{s.t}</h3>
                  <p className="type-body text-muted-foreground">{s.d}</p>
                </li>
              ))}
            </ol>
          </Reveal>
        </div>
      </section>

      <section aria-labelledby="faq-h">
        <div className={SECTION}>
          <Reveal className="flex flex-col items-center gap-6">
            <p className="type-eyebrow text-muted-foreground">Questions</p>
            <h2 id="faq-h" className={H2}>
              Before you <em>try it.</em>
            </h2>
          </Reveal>
          <Reveal className="mt-12 w-full max-w-2xl divide-y border-y text-left">
            {FAQ.map((f) => (
              <details key={f.q} className="group py-5">
                <summary className="flex cursor-pointer list-none items-center justify-between gap-6 text-lg font-medium tracking-tight text-charcoal marker:hidden [&::-webkit-details-marker]:hidden">
                  {f.q}
                  <span aria-hidden="true" className="grid size-7 shrink-0 place-items-center rounded-full border text-base transition-transform duration-200 group-open:rotate-45">+</span>
                </summary>
                <p className="type-body mt-3 max-w-[60ch] text-muted-foreground">{f.a}</p>
              </details>
            ))}
          </Reveal>
        </div>
      </section>

      <section aria-labelledby="close-h" className="px-4 pb-4 sm:px-6">
        <div className="relative isolate mx-auto w-full max-w-[1100px] overflow-hidden rounded-[var(--radius-card)] bg-ink text-cream">
          <Image src="/landing/dusk.jpg" alt="" fill sizes="(min-width: 1100px) 1100px, 100vw" className="-z-10 object-cover" />
          <div aria-hidden="true" className="absolute inset-0 -z-10 bg-[linear-gradient(to_bottom,color-mix(in_srgb,var(--ink)_62%,transparent),color-mix(in_srgb,var(--ink)_88%,transparent))]" />
          <div className="flex flex-col items-center px-6 py-[clamp(5rem,12vw,9rem)] text-center">
            <Reveal className="flex flex-col items-center gap-7">
              <h2 id="close-h" className="font-display mx-auto max-w-[14ch] text-[clamp(2.75rem,6.4vw,5.25rem)] leading-[0.97]">
                See where you stand <em>today.</em>
              </h2>
              <FocusSearchButton className="h-12 rounded-full bg-lime px-7 text-base text-charcoal hover:bg-lime/90">Get my free score</FocusSearchButton>
            </Reveal>
          </div>
        </div>
      </section>

      <footer className="text-muted-foreground">
        <div className="mx-auto flex w-full max-w-[1000px] flex-col items-center gap-3 px-4 py-10 text-center text-xs sm:px-6">
          <Logo variant="wordmark" size={18} />
          <p>Built on public Google Maps and social profile data.</p>
        </div>
      </footer>
    </>
  )
}
