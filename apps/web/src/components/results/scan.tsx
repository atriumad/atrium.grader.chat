"use client"

import { IconCheck, IconMinus } from "@tabler/icons-react"

export type ScanStep = {
  id: string
  label: string
  state: "running" | "done" | "skipped"
  meta?: string
}

// Research steps the pipeline usually runs; only used to pace the progress bar.
const EXPECTED = 5

// The scan screen: each real research step appears when it starts and settles with the value
// it found. Nothing here is scripted, so a step that does not run never shows up.
export function Scan({ steps, name }: { steps: ScanStep[]; name?: string }) {
  const finished = steps.filter((s) => s.state !== "running").length
  const analysisDone = steps.some((s) => s.id === "analysis" && s.state === "done")
  const pct = analysisDone ? 100 : Math.min(92, Math.round((finished / Math.max(EXPECTED, steps.length)) * 100))

  return (
    <section aria-label="Analysis in progress" className="mx-auto flex w-full max-w-2xl flex-col items-center gap-8 py-8 text-center">
      <div className="flex flex-col items-center gap-3">
        <p className="text-sm text-muted-foreground">The analysis</p>
        <h1 className="font-display text-4xl leading-[1.08] text-balance sm:text-5xl">
          We are doing <em>the homework.</em>
        </h1>
        <p className="max-w-[48ch] text-base/relaxed text-muted-foreground text-pretty">
          {name ? `Reading everything a customer sees before choosing ${name}.` : "Reading everything a customer sees before choosing."}
        </p>
      </div>

      <div className="flex w-full flex-col gap-6 rounded-3xl bg-foreground p-6 text-left text-primary-foreground sm:p-8">
        <div className="flex flex-col gap-3">
          <div className="flex items-baseline justify-between gap-3 text-sm">
            <span>{analysisDone ? "Analysis complete" : "Reading public sources"}</span>
            <span className="tnum opacity-70">{pct}%</span>
          </div>
          <div
            role="progressbar"
            aria-valuemin={0}
            aria-valuemax={100}
            aria-valuenow={pct}
            className="relative h-1.5 w-full overflow-hidden rounded-full bg-primary-foreground/20"
          >
            <div
              className="h-full w-full origin-left rounded-full bg-brand"
              style={{ transform: `scaleX(${pct / 100})`, transition: "transform 700ms cubic-bezier(0.23, 1, 0.32, 1)" }}
            />
            {analysisDone ? null : (
              <div aria-hidden="true" className="scan-sweep absolute inset-y-0 w-1/4 rounded-full bg-primary-foreground/30" />
            )}
          </div>
        </div>

        <ol className="flex flex-col gap-3" aria-live="polite">
          {steps.map((s) => (
            <li key={s.id} className="scan-step flex items-center gap-3 text-sm">
              <span className="grid size-5 shrink-0 place-items-center">
                {s.state === "running" ? (
                  <span className="scan-pulse size-2.5 rounded-full bg-brand" aria-hidden="true" />
                ) : s.state === "done" ? (
                  <IconCheck className="size-4 text-positive" aria-hidden="true" />
                ) : (
                  <IconMinus className="size-4 opacity-50" aria-hidden="true" />
                )}
              </span>
              <span className={s.state === "running" ? "" : "opacity-80"}>{s.label}</span>
              {s.meta ? <span className="scan-meta ms-auto tnum text-primary-foreground/70">{s.meta}</span> : null}
            </li>
          ))}
        </ol>
      </div>

      <p className="text-xs text-muted-foreground">Your report opens here when the last step finishes.</p>
    </section>
  )
}
