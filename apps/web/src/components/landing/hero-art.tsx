// The map-pin halo from the report, as the hero image: three businesses, each with a halo in its
// health colour. Decorative and labelled as a sample (the names are made up).

const PINS = [
  { key: "a", label: "1", name: "Casa Lucía", score: 79, tone: "good", x: "63%", y: "20%", size: 58, d: "0s" },
  { key: "b", label: "2", name: "Brasa & Co.", score: 72, tone: "good", x: "24%", y: "40%", size: 52, d: "-2s" },
  { key: "c", label: "You", name: "Your restaurant", score: 43, tone: "poor", x: "58%", y: "66%", size: 76, d: "-4s", you: true },
] as const

const TONE = { good: "var(--health-good)", fair: "var(--health-fair)", poor: "var(--health-poor)" }

export function HeroArt() {
  return (
    <div aria-hidden="true" className="relative mx-auto aspect-square w-full max-w-[460px] select-none lg:max-w-none">
      <svg viewBox="0 0 100 100" className="absolute inset-0 size-full">
        <circle cx="50" cy="50" r="47" fill="none" stroke="var(--ink)" strokeOpacity="0.18" strokeWidth="0.35" strokeDasharray="1.2 2.2" />
        <circle cx="50" cy="50" r="31" fill="none" stroke="var(--ink)" strokeOpacity="0.1" strokeWidth="0.3" strokeDasharray="1 2" />
      </svg>
      {PINS.map((p) => {
        const color = TONE[p.tone]
        return (
          <div key={p.key} className="halo-float absolute" style={{ left: p.x, top: p.y, ["--d" as string]: p.d, translate: "-50% -50%" }}>
            <div
              className="absolute rounded-full"
              style={{
                width: p.size * 3.2,
                height: p.size * 3.2,
                left: "50%",
                top: "50%",
                translate: "-50% -50%",
                background: `radial-gradient(circle, color-mix(in oklab, ${color} 62%, transparent) 0 36%, color-mix(in oklab, ${color} 22%, transparent) 58%, transparent 72%)`,
              }}
            />
            <div
              className="relative grid place-items-center rounded-full font-semibold"
              style={{
                width: p.size,
                height: p.size,
                background: "you" in p ? "var(--charcoal)" : "var(--ink)",
                color: "you" in p ? "var(--cream)" : "var(--lime)",
                border: "3px solid var(--card)",
                boxShadow: "var(--shadow-rest)",
                outline: `2px solid ${color}`,
                outlineOffset: 3,
                fontSize: "you" in p ? 17 : 18,
              }}
            >
              {p.label}
            </div>
            <div className="absolute left-1/2 top-full mt-3 -translate-x-1/2 whitespace-nowrap rounded-full border bg-card px-3 py-1 text-xs shadow-[var(--shadow-soft)]">
              <span className="text-body">{p.name}</span> <span className="font-serif text-sm text-charcoal">{p.score}</span>
            </div>
          </div>
        )
      })}
      <p className="absolute right-0 bottom-0 text-[0.6875rem] text-muted-foreground">Sample</p>
    </div>
  )
}
