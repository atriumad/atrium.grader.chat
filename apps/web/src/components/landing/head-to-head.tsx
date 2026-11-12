import { Reveal } from "./reveal"

// Two made-up restaurants, side by side, the way a guest compares them in seconds. Every metric is
// written out ("Ahead" / "Behind"), not just coloured.

const ROWS: Array<{ label: string; you: string; them: string; youAhead: boolean }> = [
  { label: "Google rating", you: "4.2", them: "4.6", youAhead: false },
  { label: "Reviews", you: "312", them: "1,480", youAhead: false },
  { label: "Followers", you: "1.1K", them: "8.9K", youAhead: false },
  { label: "Last post", you: "18 days ago", them: "2 days ago", youAhead: false },
]

function Side({ title, values, tone }: { title: string; values: string[]; tone: "you" | "them" }) {
  return (
    <div className={`flex-1 rounded-[var(--radius-card-sm)] border p-6 text-center shadow-[var(--shadow-rest)] ${tone === "you" ? "bg-card" : "bg-ink text-cream"}`}>
      <p className={`type-eyebrow ${tone === "you" ? "text-muted-foreground" : "text-lime"}`}>{title}</p>
      <ul className="mt-5 flex flex-col gap-5">
        {values.map((v, i) => (
          <li key={i} className="flex flex-col items-center gap-1">
            <span className={`font-serif leading-none tnum ${v.length > 6 ? "text-3xl" : "text-5xl"} ${tone === "you" ? "text-charcoal" : "text-cream"}`}>{v}</span>
            <span className={`text-xs ${tone === "you" ? "text-muted-foreground" : "text-cream/70"}`}>{ROWS[i].label}</span>
          </li>
        ))}
      </ul>
      <p className={`mt-6 inline-flex rounded-full px-3 py-1 text-xs font-medium ${tone === "you" ? "bg-red-soft text-error" : "bg-green-soft text-green-ink"}`}>{tone === "you" ? "Behind on every line" : "Ahead on every line"}</p>
    </div>
  )
}

export function HeadToHead() {
  return (
    <Reveal className="mx-auto mt-14 w-full max-w-3xl">
      <div className="flex flex-col items-stretch gap-4 sm:flex-row sm:items-center">
        <Side title="Your restaurant" tone="you" values={ROWS.map((r) => r.you)} />
        <span aria-hidden="true" className="self-center font-serif text-3xl italic text-muted-soft">vs</span>
        <Side title="Next door" tone="them" values={ROWS.map((r) => r.them)} />
      </div>
      <p className="mt-5 text-center text-xs text-muted-foreground">Sample restaurants. Yours will use your real numbers.</p>
    </Reveal>
  )
}
