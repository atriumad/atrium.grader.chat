import { tierOf, TIER_VAR } from "@/lib/metrics"
import type { Gap } from "@/lib/gaps"

// One thin bar on a 0-100 scale: the business in its tier colour, the competitors in neutral.
function Bar({ label, value, color }: { label: string; value: number; color: string }) {
  return (
    <div className="grid grid-cols-[5.5rem_1fr_1.75rem] items-center gap-2 text-xs text-muted-foreground">
      <span>{label}</span>
      <span className="h-1.5 w-full overflow-hidden rounded-full bg-muted" aria-hidden="true">
        <span className="block h-full rounded-full" style={{ width: `${Math.max(2, Math.min(100, value))}%`, background: color }} />
      </span>
      <span className="text-end text-foreground tnum">{Math.round(value)}</span>
    </div>
  )
}

export function Gaps({ gaps, ahead }: { gaps: Gap[]; ahead: boolean }) {
  if (gaps.length === 0) {
    return (
      <section aria-label="What holds you back" className="rounded-2xl border bg-card px-5 py-4 text-sm text-muted-foreground">
        {ahead
          ? "No signals are below your competitors' average. Keep the pace."
          : "Not enough data to compare signals with your competitors."}
      </section>
    )
  }
  return (
    <section aria-labelledby="gaps-title" className="flex h-full flex-col gap-3">
      <h3 id="gaps-title" className="text-sm font-medium">What holds you back</h3>
      <ol className="flex flex-1 flex-col gap-3">
        {gaps.map((g, i) => (
          <li key={g.key} className="reveal-rise flex flex-1 flex-col justify-between gap-4 rounded-2xl border bg-card p-4" style={{ "--d": `${i * 80}ms` } as React.CSSProperties}>
            <div className="flex flex-col gap-3">
              <div className="flex items-baseline justify-between gap-3">
                <span className="flex items-baseline gap-2.5">
                  <span className="font-display text-xl leading-none text-brand tnum">{i + 1}</span>
                  <span className="font-medium">{g.label}</span>
                </span>
                <span className="text-xs font-medium text-brand tnum">−{g.behind} pts</span>
              </div>
              <div className="flex flex-col gap-1.5">
                <Bar label="You" value={g.youScore} color={TIER_VAR[tierOf(g.youScore)]} />
                <Bar label="Competencia" value={g.avgScore} color="var(--muted-foreground)" />
              </div>
              <p className="text-xs text-muted-foreground tnum">
                You: {g.you} · Competitors: {g.rivals}
              </p>
            </div>
            <div className="flex flex-col gap-1 rounded-xl bg-muted/70 px-3.5 py-3">
              <p className="text-xs font-medium text-muted-foreground">What to do</p>
              <p className="text-sm text-pretty">{g.action}</p>
            </div>
          </li>
        ))}
      </ol>
    </section>
  )
}
