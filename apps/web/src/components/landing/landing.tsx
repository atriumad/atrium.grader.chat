import { Logo } from "@/components/brand/logo"
import { HomeJsonLd } from "@/components/seo/json-ld"
import { FAQ } from "@/lib/site"

import { FocusSearchButton } from "./focus-search"
import { HeadToHead } from "./head-to-head"
import { OrbitField } from "./orbit-field"
import { ReportPeek } from "./report-peek"
import { Reveal } from "./reveal"
import { SignalExplorer } from "./signal-explorer"
import { StepsTimeline } from "./steps-timeline"

// The long, editorial part of the home page, under the search box. Everything is centred, in
// reading-width columns. Server-rendered: it is what search engines read, so it stays factual.

const H2 = "font-display mx-auto max-w-[20ch] text-[clamp(2.5rem,5.6vw,4.75rem)] leading-[0.98]"
const SECTION = "mx-auto flex w-full max-w-[1100px] flex-col items-center px-4 py-[clamp(4.5rem,11vw,8rem)] text-center sm:px-6"

function Chapter({ n, label }: { n: string; label: string }) {
  return (
    <p className="type-eyebrow flex flex-col items-center gap-3 text-muted-foreground">
      <span className="font-serif text-3xl leading-none tracking-normal normal-case text-charcoal tnum">{n}</span>
      {label}
    </p>
  )
}

export function Landing() {
  return (
    <>
      <HomeJsonLd />

      {/* 01 · the problem */}
      <section aria-labelledby="problem-h" className="border-t">
        <div className={SECTION}>
          <Reveal className="flex flex-col items-center gap-6">
            <Chapter n="01" label="The problem" />
            <h2 id="problem-h" className={H2}>
              Your guests compare you <em>before they walk in.</em>
            </h2>
            <p className="type-lead mx-auto text-body">They check your Google stars, scroll your Instagram and look at the place next door. If the competition looks livelier, that is where dinner happens.</p>
          </Reveal>
          <HeadToHead />
          <Reveal className="mt-10">
            <p className="type-body mx-auto text-muted-foreground">You rarely see it happen. The Grader puts you side by side with the restaurants around you, on the same rules, so you can see where you win and where you quietly lose.</p>
          </Reveal>
        </div>
      </section>

      {/* 02 · what we measure */}
      <section aria-labelledby="measure-h" className="bg-off-white">
        <div className={SECTION}>
          <Reveal className="flex flex-col items-center gap-6">
            <Chapter n="02" label="What we measure" />
            <h2 id="measure-h" className={H2}>
              Five signals. <em>One honest score.</em>
            </h2>
            <p className="type-lead mx-auto text-body">Every restaurant, yours and the competition, is scored with the same rules. When something cannot be read, the report says so instead of guessing.</p>
          </Reveal>
          <Reveal className="w-full" delay={80}>
            <SignalExplorer />
          </Reveal>
        </div>
      </section>

      {/* 03 · the report */}
      <section aria-labelledby="report-h">
        <div className={SECTION}>
          <Reveal className="flex flex-col items-center gap-6">
            <Chapter n="03" label="What you get" />
            <h2 id="report-h" className={H2}>
              A score you can read <em>in ten seconds.</em>
            </h2>
            <p className="type-lead mx-auto text-body">Where you stand, who is ahead and what is holding you back, in that order. Then a written analysis and a chat to go deeper.</p>
          </Reveal>
          <div className="mt-14 w-full max-w-5xl text-left">
            <ReportPeek />
          </div>
          <Reveal className="mt-12">
            <ul className="mx-auto flex max-w-3xl flex-wrap justify-center gap-2.5">
              {["Score vs. nearby competitors", "A map with a halo for each score", "A written analysis", "The 3 actions that matter most", "An assistant for your questions", "Book a 30-minute call"].map((t) => (
                <li key={t} className="rounded-full border bg-card px-4 py-2 text-sm text-body">{t}</li>
              ))}
            </ul>
          </Reveal>
        </div>
      </section>

      {/* 04 · how it works */}
      <section aria-labelledby="how-h" className="bg-off-white">
        <div className={SECTION}>
          <Reveal className="flex flex-col items-center gap-6">
            <Chapter n="04" label="How it works" />
            <h2 id="how-h" className={H2}>
              About 40 seconds, <em>start to finish.</em>
            </h2>
          </Reveal>
          <StepsTimeline />
        </div>
      </section>

      {/* 05 · FAQ */}
      <section aria-labelledby="faq-h">
        <div className={SECTION}>
          <Reveal className="flex flex-col items-center gap-6">
            <Chapter n="05" label="Questions" />
            <h2 id="faq-h" className={H2}>
              Before you <em>try it.</em>
            </h2>
          </Reveal>
          <Reveal delay={100} className="mt-12 w-full max-w-2xl divide-y border-y text-left">
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

      {/* closing band */}
      <section aria-labelledby="close-h" className="relative isolate overflow-hidden bg-ink text-cream">
        <OrbitField on="ink" />
        <div aria-hidden="true" className="absolute inset-0 -z-10 bg-[radial-gradient(ellipse_50%_55%_at_50%_50%,var(--ink)_40%,transparent_100%)]" />
        <div className="mx-auto flex w-full max-w-[1100px] flex-col items-center gap-8 px-4 py-[clamp(6rem,14vw,10rem)] text-center sm:px-6">
          <Reveal className="flex flex-col items-center gap-5">
            <p className="type-eyebrow text-lime">Free · no sign-up</p>
            <h2 id="close-h" className="font-display mx-auto max-w-[14ch] text-[clamp(2.75rem,6.4vw,5.5rem)] leading-[0.95]">
              See where you stand <em>today.</em>
            </h2>
          </Reveal>
          <Reveal delay={100}>
            <FocusSearchButton className="h-12 bg-lime px-7 text-base text-charcoal hover:bg-lime/90">Get my free score</FocusSearchButton>
          </Reveal>
        </div>
      </section>

      <footer className="bg-ink text-cream/70">
        <div className="mx-auto flex w-full max-w-[1100px] flex-col items-center gap-3 border-t border-[var(--line-inverse)] px-4 py-8 text-center text-xs sm:px-6">
          <Logo variant="wordmark" size={18} tone="cream" />
          <p>Built on public Google Maps and social profile data.</p>
        </div>
      </footer>
    </>
  )
}
