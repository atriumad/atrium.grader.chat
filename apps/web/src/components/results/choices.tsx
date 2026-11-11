"use client"

import { IconMapPin, IconStarFilled } from "@tabler/icons-react"

import type { Place } from "@/lib/places"

// Asks the user which location they meant (franchise, typo, weak match).
export function Choices({
  message,
  options,
  chosenId,
  disabled,
  onPick,
}: {
  message: string
  options: Place[]
  chosenId?: string
  disabled: boolean
  onPick: (place: Place) => void
}) {
  return (
    <section aria-label="Pick the location" className="report-rise flex max-w-[68ch] flex-col gap-4">
      <p className="font-display text-xl leading-snug text-balance">{message}</p>
      <ul className="flex flex-col gap-2">
        {options.map((o) => {
          const chosen = chosenId === o.id
          return (
            <li key={o.id}>
              <button
                type="button"
                disabled={disabled || (!!chosenId && !chosen)}
                onClick={() => onPick(o)}
                aria-pressed={chosen}
                className={`flex w-full items-start gap-3 rounded-xl border bg-card px-4 py-3 text-left transition-colors enabled:hover:bg-secondary disabled:opacity-50 ${
                  chosen ? "border-foreground" : ""
                }`}
              >
                <IconMapPin className="mt-0.5 size-4 shrink-0 text-brand" aria-hidden="true" />
                <span className="flex min-w-0 flex-1 flex-col">
                  <span className="font-medium text-pretty">{o.name}</span>
                  <span className="text-sm text-muted-foreground text-pretty">{o.address}</span>
                </span>
                {o.rating ? (
                  <span className="inline-flex shrink-0 items-center gap-1 text-sm tnum">
                    <IconStarFilled className="size-3.5 text-brand" aria-hidden="true" />
                    {o.rating.toFixed(1)}
                    {o.reviews ? <span className="text-muted-foreground">({o.reviews.toLocaleString("en-US")})</span> : null}
                  </span>
                ) : null}
              </button>
            </li>
          )
        })}
      </ul>
      <p className="text-sm text-muted-foreground text-pretty">
        Not on the list? Type it with the city, or use its Instagram @.
      </p>
    </section>
  )
}
