import { IconCheck, IconLoader2 } from "@tabler/icons-react"

// Progress as a checklist: completed steps stay visible, the current one spins.
export function Steps({ steps, working }: { steps: string[]; working: boolean }) {
  return (
    <ol className="flex flex-col gap-2 text-sm" aria-live="polite">
      {steps.map((s, i) => {
        const current = working && i === steps.length - 1
        return (
          <li key={`${i}-${s}`} className="flex items-center gap-2.5 text-muted-foreground motion-safe:animate-in motion-safe:fade-in-0 motion-safe:slide-in-from-bottom-1">
            {current ? (
              <IconLoader2 className="size-4 shrink-0 text-brand motion-safe:animate-spin" aria-hidden="true" />
            ) : (
              <IconCheck className="size-4 shrink-0 text-positive" aria-hidden="true" />
            )}
            <span className={current ? "text-foreground" : ""}>{s}</span>
          </li>
        )
      })}
    </ol>
  )
}
