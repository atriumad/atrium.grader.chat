// A radar of the neighbourhood: dashed rings with restaurants orbiting, each wearing its score halo
// (the same halo as the map pins). Decorative and clearly sample data; it sits behind centred
// content. CSS only: rings turn slowly, pins counter-turn so numbers stay upright.

type Tone = "good" | "fair" | "poor"
type Pin = { a: number; n: number; tone: Tone; size: number }
type Ring = { size: number; dur: number; reverse?: boolean; pins: Pin[] }

const RINGS: Ring[] = [
  { size: 46, dur: 120, pins: [{ a: 200, n: 72, tone: "good", size: 40 }, { a: 20, n: 58, tone: "fair", size: 34 }] },
  { size: 72, dur: 170, reverse: true, pins: [{ a: 300, n: 79, tone: "good", size: 52 }, { a: 120, n: 43, tone: "poor", size: 46 }, { a: 210, n: 66, tone: "fair", size: 36 }] },
  { size: 100, dur: 240, pins: [{ a: 80, n: 81, tone: "good", size: 48 }, { a: 250, n: 37, tone: "poor", size: 38 }, { a: 340, n: 64, tone: "fair", size: 42 }] },
]

const COLOR: Record<Tone, string> = { good: "var(--health-good)", fair: "var(--health-fair)", poor: "var(--health-poor)" }

const round = (n: number) => Math.round(n * 100) / 100

export function OrbitField({ on = "light" }: { on?: "light" | "ink" }) {
  const ink = on === "ink"
  return (
    <div aria-hidden="true" className="pointer-events-none absolute top-1/2 left-1/2 -z-10 aspect-square w-[max(980px,118vw)] max-w-[1700px] -translate-x-1/2 -translate-y-1/2 select-none">
      {RINGS.map((ring, ri) => (
        <div
          key={ri}
          className="orbit absolute rounded-full border border-dashed"
          style={{
            inset: `${(100 - ring.size) / 2}%`,
            borderColor: ink ? "var(--line-inverse)" : "color-mix(in srgb, var(--ink) 26%, transparent)",
            ["--dur" as string]: `${ring.dur}s`,
            animationDirection: ring.reverse ? "reverse" : "normal",
          }}
        >
          {ring.pins.map((p) => {
            const rad = (p.a * Math.PI) / 180
            const color = COLOR[p.tone]
            return (
              <div key={p.a} className="absolute" style={{ left: `${round(50 + 50 * Math.cos(rad))}%`, top: `${round(50 + 50 * Math.sin(rad))}%` }}>
                <div className="orbit-counter" style={{ ["--dur" as string]: `${ring.dur}s`, animationDirection: ring.reverse ? "normal" : "reverse", translate: "-50% -50%" }}>
                  <div className="orbit-pin relative transition-transform duration-500">
                    <div
                      className="absolute rounded-full"
                      style={{
                        width: p.size * 3.1,
                        height: p.size * 3.1,
                        left: "50%",
                        top: "50%",
                        translate: "-50% -50%",
                        background: `radial-gradient(circle, color-mix(in oklab, ${color} ${ink ? 55 : 60}%, transparent) 0 36%, color-mix(in oklab, ${color} 20%, transparent) 58%, transparent 72%)`,
                      }}
                    />
                    <div
                      className="relative grid place-items-center rounded-full font-semibold"
                      style={{
                        width: p.size,
                        height: p.size,
                        background: ink ? "var(--lime)" : "var(--ink)",
                        color: ink ? "var(--ink)" : "var(--lime)",
                        border: `3px solid ${ink ? "var(--ink)" : "var(--card)"}`,
                        outline: `2px solid ${color}`,
                        outlineOffset: 3,
                        fontSize: Math.round(p.size * 0.36),
                      }}
                    >
                      {p.n}
                    </div>
                  </div>
                </div>
              </div>
            )
          })}
        </div>
      ))}
    </div>
  )
}
