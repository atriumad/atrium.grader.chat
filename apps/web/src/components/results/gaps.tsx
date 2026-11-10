import type { Gap } from "@/lib/gaps"

export function Gaps({ gaps, ahead }: { gaps: Gap[]; ahead: boolean }) {
  if (gaps.length === 0) {
    return (
      <section aria-label="Lo que te frena" className="rounded-2xl border bg-card px-5 py-4 text-sm text-muted-foreground">
        {ahead
          ? "No hay señales por debajo del promedio de tu competencia. Mantén el ritmo."
          : "No hay datos suficientes para comparar señales con la competencia."}
      </section>
    )
  }
  return (
    <section aria-label="Lo que te frena" className="flex flex-col gap-3">
      <h3 className="text-sm font-medium">Lo que te frena</h3>
      <ol className="grid gap-3 md:grid-cols-3">
        {gaps.map((g, i) => (
          <li key={g.key} className="reveal-rise flex flex-col gap-3 rounded-2xl border bg-card p-4" style={{ "--d": `${i * 80}ms` } as React.CSSProperties}>
            <div className="flex items-baseline justify-between gap-3">
              <span className="font-medium">{g.label}</span>
              <span className="text-xs text-brand tnum">−{g.behind} pts</span>
            </div>
            <p className="text-sm tnum">
              <span className="block text-foreground">Tú: {g.you}</span>
              <span className="block text-muted-foreground">Competencia: {g.rivals}</span>
            </p>
            <p className="text-sm text-muted-foreground text-pretty">{g.action}</p>
          </li>
        ))}
      </ol>
    </section>
  )
}
