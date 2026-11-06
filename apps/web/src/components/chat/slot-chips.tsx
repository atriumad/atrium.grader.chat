"use client"

import { IconCalendarEvent } from "@tabler/icons-react"

import type { Slot } from "@/lib/chat/types"

// Real free times from the agency calendar. Tapping one tells the assistant which one.
export function SlotChips({ slots, disabled, onPick }: { slots: Slot[]; disabled: boolean; onPick: (s: Slot) => void }) {
  // Labels look like "viernes, 6 de noviembre, 9:00 a.m. (EST)". The day goes in the heading,
  // each button shows only the time, and the time zone is said once.
  const days = new Map<string, Slot[]>()
  for (const s of slots) {
    const [weekday, date] = s.label.split(", ")
    const key = `${weekday} ${date}`
    days.set(key, [...(days.get(key) ?? []), s])
  }
  const zone = slots[0]?.label.match(/\(([^)]+)\)\s*$/)?.[1]
  return (
    <div className="report-rise flex max-w-[68ch] flex-col gap-4" role="group" aria-label="Horarios disponibles">
      {[...days.entries()].map(([day, list]) => (
        <div key={day} className="flex flex-col gap-1.5">
          <p className="text-sm font-medium first-letter:uppercase">{day}</p>
          <div className="flex flex-wrap gap-2">
            {list.map((s) => {
              const time = (s.label.split(", ")[2] ?? s.label).replace(/\s*\([^)]*\)\s*$/, "")
              return (
                <button
                  key={s.start}
                  type="button"
                  disabled={disabled}
                  onClick={() => onPick(s)}
                  aria-label={s.label}
                  className="inline-flex items-center gap-1.5 rounded-full border bg-card px-3.5 py-1.5 text-sm tnum transition-colors enabled:hover:bg-secondary disabled:opacity-50"
                >
                  <IconCalendarEvent className="size-3.5 text-brand" aria-hidden="true" />
                  {time}
                </button>
              )
            })}
          </div>
        </div>
      ))}
      {zone ? <p className="text-xs text-muted-foreground">Horarios en hora del {zone === "EST" || zone === "EDT" ? "Este de EE. UU." : zone} ({zone}).</p> : null}
    </div>
  )
}
