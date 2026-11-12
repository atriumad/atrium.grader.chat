import { Logo } from "@/components/brand/logo"
import { HomeJsonLd } from "@/components/seo/json-ld"
import { FAQ } from "@/lib/site"

import { FocusSearchButton } from "./focus-search"
import { Reveal } from "./reveal"
import { ReportPeek } from "./report-peek"

// The long, editorial part of the home page, under the search box. Server-rendered: it is what
// search engines read, so everything here is factual and matches the product.

const SIGNALS = [
  { n: "01", name: "Engagement", ask: "Do people react when you post?", d: "Likes, comments and views, judged against what is normal for an account your size. Big accounts always get less, so the bar moves with you." },
  { n: "02", name: "Reputation", ask: "What do guests say on Google?", d: "Your Google rating and how many reviews back it up. Three five-star reviews do not outrank two thousand good ones." },
  { n: "03", name: "Activity", ask: "Are you showing up often?", d: "How often you post and how recently you last did. A quiet account tells guests the kitchen might be quiet too." },
  { n: "04", name: "Audience", ask: "How many people can you reach?", d: "The size of your following across the networks you use." },
  { n: "05", name: "Presence", ask: "Where are you active?", d: "How many networks you are actually using, not just how many you signed up for." },
]

const STEPS = [
  { n: "1", t: "Find your restaurant", d: "Type its name and pick it from the Google Maps suggestions. An Instagram @handle works too." },
  { n: "2", t: "We read the public data", d: "Your Google listing, the places of the same type within about two miles, and everyone's public social profiles. You watch each step happen." },
  { n: "3", t: "Get your score and a plan", d: "Your Atrium Score, a map of the competition and a written analysis with the actions that matter most. Then ask questions or book a 30-minute call." },
]

function Chapter({ n, label }: { n: string; label: string }) {
  return (
    <p className="type-eyebrow flex items-center gap-3 text-muted-foreground">
      <span className="font-serif text-base tracking-normal normal-case text-charcoal tnum">{n}</span>
      <span aria-hidden="true" className="h-px w-8 bg-[var(--line)]" />
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
        <div className="mx-auto grid w-full max-w-[1200px] gap-x-16 gap-y-8 px-4 py-[clamp(4rem,10vw,7.5rem)] sm:px-6 lg:grid-cols-[minmax(0,1fr)_minmax(0,0.85fr)]">
          <Reveal className="flex flex-col gap-6">
            <Chapter n="01" label="The problem" />
            <h2 id="problem-h" className="font-display text-[clamp(2.25rem,4.6vw,4rem)] leading-[1]">
              Your guests compare you <em>before they walk in.</em>
            </h2>
          </Reveal>
          <Reveal delay={120} className="flex flex-col gap-5 lg:pt-12">
            <p className="type-lead text-body">They check your Google stars, scroll your Instagram and look at the place next door. If the competition looks livelier, that is where dinner happens.</p>
            <p className="type-body text-muted-foreground">You rarely see it happen. The Grader puts you side by side with the restaurants around you, on the same rules, so you can see where you win and where you quietly lose.</p>
          </Reveal>
        </div>
      </section>

      {/* 02 · what we measure */}
      <section aria-labelledby="measure-h" className="bg-off-white">
        <div className="mx-auto w-full max-w-[1200px] px-4 py-[clamp(4rem,10vw,7.5rem)] sm:px-6">
          <Reveal className="flex max-w-3xl flex-col gap-6">
            <Chapter n="02" label="What we measure" />
            <h2 id="measure-h" className="font-display text-[clamp(2.25rem,4.6vw,4rem)] leading-[1]">
              Five signals. <em>One honest score.</em>
            </h2>
            <p className="type-lead text-body">Every restaurant, yours and the competition, is scored with the same rules. When something cannot be read, the report says so instead of guessing.</p>
          </Reveal>
          <ol className="mt-12 flex flex-col">
            {SIGNALS.map((s, i) => (
              <Reveal as="li" key={s.n} delay={i * 60} className="grid gap-x-10 gap-y-2 border-t py-7 sm:grid-cols-[5rem_minmax(0,1fr)_minmax(0,1.3fr)] sm:items-baseline">
                <span className="font-serif text-5xl leading-none text-muted-soft tnum">{s.n}</span>
                <div>
                  <h3 className="text-xl font-medium tracking-tight text-charcoal">{s.name}</h3>
                  <p className="mt-1 text-sm text-green">{s.ask}</p>
                </div>
                <p className="type-body text-muted-foreground">{s.d}</p>
              </Reveal>
            ))}
          </ol>
        </div>
      </section>

      {/* 03 · the report */}
      <section aria-labelledby="report-h">
        <div className="mx-auto w-full max-w-[1200px] px-4 py-[clamp(4rem,10vw,7.5rem)] sm:px-6">
          <Reveal className="flex max-w-3xl flex-col gap-6">
            <Chapter n="03" label="What you get" />
            <h2 id="report-h" className="font-display text-[clamp(2.25rem,4.6vw,4rem)] leading-[1]">
              A score you can read <em>in ten seconds.</em>
            </h2>
            <p className="type-lead text-body">Where you stand, who is ahead and what is holding you back, in that order. Then a written analysis and a chat to go deeper.</p>
          </Reveal>
          <div className="mt-12">
            <ReportPeek />
          </div>
          <Reveal as="div" className="mt-10">
            <ul className="grid gap-x-10 gap-y-3 text-sm text-body sm:grid-cols-2">
              {["Your Atrium Score against nearby competitors", "A map of who is around you, with a halo for each score", "A written analysis and the three actions that matter most", "An assistant that answers questions about your numbers"].map((t) => (
                <li key={t} className="flex gap-3">
                  <span aria-hidden="true" className="mt-[0.45em] size-1.5 shrink-0 rounded-full bg-green-fill" />
                  {t}
                </li>
              ))}
            </ul>
          </Reveal>
        </div>
      </section>

      {/* 04 · how it works */}
      <section aria-labelledby="how-h" className="bg-off-white">
        <div className="mx-auto w-full max-w-[1200px] px-4 py-[clamp(4rem,10vw,7.5rem)] sm:px-6">
          <Reveal className="flex max-w-3xl flex-col gap-6">
            <Chapter n="04" label="How it works" />
            <h2 id="how-h" className="font-display text-[clamp(2.25rem,4.6vw,4rem)] leading-[1]">
              About 40 seconds, <em>start to finish.</em>
            </h2>
          </Reveal>
          <ol className="mt-12 grid gap-x-12 gap-y-10 md:grid-cols-3">
            {STEPS.map((s, i) => (
              <Reveal as="li" key={s.n} delay={i * 85} className="flex flex-col gap-3">
                <span className="font-serif text-7xl leading-none text-charcoal tnum">{s.n}</span>
                <h3 className="text-xl font-medium tracking-tight text-charcoal">{s.t}</h3>
                <p className="type-body text-muted-foreground">{s.d}</p>
              </Reveal>
            ))}
          </ol>
        </div>
      </section>

      {/* 05 · FAQ */}
      <section aria-labelledby="faq-h">
        <div className="mx-auto grid w-full max-w-[1200px] gap-x-16 gap-y-10 px-4 py-[clamp(4rem,10vw,7.5rem)] sm:px-6 lg:grid-cols-[minmax(0,0.8fr)_minmax(0,1.2fr)]">
          <Reveal className="flex flex-col gap-6">
            <Chapter n="05" label="Questions" />
            <h2 id="faq-h" className="font-display text-[clamp(2.25rem,4.6vw,4rem)] leading-[1]">
              Before you <em>try it.</em>
            </h2>
          </Reveal>
          <Reveal delay={100} className="divide-y border-y">
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
      <section aria-labelledby="close-h" className="bg-ink text-cream">
        <div className="mx-auto flex w-full max-w-[1200px] flex-col items-start gap-8 px-4 py-[clamp(4rem,9vw,6.5rem)] sm:px-6 md:flex-row md:items-end md:justify-between">
          <Reveal className="flex max-w-2xl flex-col gap-5">
            <p className="type-eyebrow text-lime">Free · no sign-up</p>
            <h2 id="close-h" className="font-display text-[clamp(2.5rem,5.4vw,4.75rem)] leading-[0.98]">
              See where you stand <em>today.</em>
            </h2>
          </Reveal>
          <Reveal delay={100}>
            <FocusSearchButton className="h-12 bg-lime px-6 text-base text-charcoal hover:bg-lime/90">Get my free score</FocusSearchButton>
          </Reveal>
        </div>
      </section>

      <footer className="bg-ink text-cream/70">
        <div className="mx-auto flex w-full max-w-[1200px] flex-wrap items-center justify-between gap-4 border-t border-[var(--line-inverse)] px-4 py-8 text-xs sm:px-6">
          <Logo variant="wordmark" size={18} tone="cream" />
          <p>Built on public Google Maps and social profile data.</p>
        </div>
      </footer>
    </>
  )
}
