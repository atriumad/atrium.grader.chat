import { FAQ } from "@/lib/site"

// Crawlable explanation under the search box. It is what search engines (and curious visitors) read,
// so it stays factual: no weights or numbers an admin can change from the panel.

const STEPS = [
  { t: "Find your business", d: "Type its name and pick it from the Google Maps suggestions. Instagram handles work too." },
  { t: "We read the public data", d: "Your Google listing, the nearby businesses of the same type, and everyone's public social profiles." },
  { t: "Get your score and a plan", d: "An Atrium Score, a map of your competitors, and a written analysis of what to improve first." },
]

const PARTS = [
  { t: "Engagement", d: "How much your followers interact, judged against what is normal for an account of your size." },
  { t: "Reputation", d: "Your Google rating and how many reviews support it." },
  { t: "Activity", d: "How often you post and how recently you last did." },
  { t: "Audience", d: "The size of your following across networks." },
  { t: "Presence", d: "How many networks you are actively using." },
]

export function HomeContent() {
  return (
    <div className="mx-auto flex w-full max-w-3xl flex-col gap-14 px-4 pt-6 pb-24 sm:px-6">
      <section aria-labelledby="how-h">
        <h2 id="how-h" className="font-display text-2xl text-balance">How it works</h2>
        <ol className="mt-5 grid gap-5 sm:grid-cols-3">
          {STEPS.map((s, i) => (
            <li key={s.t} className="flex flex-col gap-1.5">
              <span className="text-xs font-medium text-muted-foreground tnum">Step {i + 1}</span>
              <h3 className="text-sm font-medium">{s.t}</h3>
              <p className="text-sm/relaxed text-muted-foreground text-pretty">{s.d}</p>
            </li>
          ))}
        </ol>
      </section>

      <section aria-labelledby="score-h">
        <h2 id="score-h" className="font-display text-2xl text-balance">What the Atrium Score measures</h2>
        <p className="mt-2 max-w-[62ch] text-sm/relaxed text-muted-foreground text-pretty">
          One number from 0 to 100, built from five parts. Every competitor is scored with the same rules, so the comparison is fair.
        </p>
        <dl className="mt-5 grid gap-x-8 gap-y-4 sm:grid-cols-2">
          {PARTS.map((p) => (
            <div key={p.t}>
              <dt className="text-sm font-medium">{p.t}</dt>
              <dd className="mt-0.5 text-sm/relaxed text-muted-foreground text-pretty">{p.d}</dd>
            </div>
          ))}
        </dl>
      </section>

      <section aria-labelledby="faq-h">
        <h2 id="faq-h" className="font-display text-2xl text-balance">Frequently asked questions</h2>
        <div className="mt-4 divide-y rounded-2xl border bg-card">
          {FAQ.map((f) => (
            <details key={f.q} className="group px-4 py-3 sm:px-5">
              <summary className="cursor-pointer list-none text-sm font-medium marker:hidden [&::-webkit-details-marker]:hidden">{f.q}</summary>
              <p className="mt-2 max-w-[62ch] text-sm/relaxed text-muted-foreground text-pretty">{f.a}</p>
            </details>
          ))}
        </div>
      </section>
    </div>
  )
}
