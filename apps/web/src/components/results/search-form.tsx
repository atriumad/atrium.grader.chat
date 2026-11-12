"use client"

import * as React from "react"
import { IconMapPin, IconSearch } from "@tabler/icons-react"

import { Button } from "@/components/ui/button"

export type PickedPlace = { placeId: string; name: string; detail: string }

// An Instagram handle or link skips the Google suggestions: it is analyzed as typed.
const isInstagram = (q: string) => q.startsWith("@") || /instagram\.com/i.test(q)

// The entry point: type the business name, pick it from Google's suggestions, analyse.
export function SearchForm({
  value,
  onValueChange,
  onSubmit,
  onPick,
  disabled,
}: {
  value: string
  onValueChange: (v: string) => void
  onSubmit: (query: string) => void
  onPick: (place: PickedPlace) => void
  disabled?: boolean
}) {
  const query = value.trim()
  const [items, setItems] = React.useState<PickedPlace[]>([])
  const [open, setOpen] = React.useState(false)
  const [active, setActive] = React.useState(-1)
  const [loading, setLoading] = React.useState(false)
  const [searched, setSearched] = React.useState("")
  const token = React.useRef<string>("")
  const listId = React.useId()

  React.useEffect(() => {
    token.current = crypto.randomUUID()
  }, [])

  // Debounced lookup; a newer keystroke cancels the previous request.
  React.useEffect(() => {
    if (query.length < 2 || isInstagram(query)) {
      setItems([])
      setSearched("")
      setLoading(false)
      return
    }
    const ctrl = new AbortController()
    setLoading(true)
    const id = setTimeout(async () => {
      try {
        const res = await fetch(`/api/places?q=${encodeURIComponent(query)}&token=${token.current}`, { signal: ctrl.signal })
        const json = (await res.json()) as { suggestions?: PickedPlace[] }
        setItems(json.suggestions ?? [])
        setSearched(query)
        setActive(-1)
      } catch {
        // aborted or offline: keep what is shown
      } finally {
        if (!ctrl.signal.aborted) setLoading(false)
      }
    }, 220)
    return () => {
      clearTimeout(id)
      ctrl.abort()
    }
  }, [query])

  function choose(p: PickedPlace) {
    setOpen(false)
    setItems([])
    token.current = crypto.randomUUID() // a new billing session after each selection
    onPick(p)
  }

  function onKeyDown(e: React.KeyboardEvent<HTMLInputElement>) {
    if (e.key === "ArrowDown" && items.length) {
      e.preventDefault()
      setOpen(true)
      setActive((i) => (i + 1) % items.length)
    } else if (e.key === "ArrowUp" && items.length) {
      e.preventDefault()
      setActive((i) => (i <= 0 ? items.length - 1 : i - 1))
    } else if (e.key === "Escape") {
      setOpen(false)
    } else if (e.key === "Enter" && open && active >= 0 && items[active]) {
      e.preventDefault()
      choose(items[active])
    }
  }

  const showList = open && !disabled && query.length >= 2 && !isInstagram(query)
  const empty = showList && !loading && searched === query && items.length === 0

  return (
    <form
      role="search"
      onSubmit={(e) => {
        e.preventDefault()
        if (!query || disabled) return
        // Enter without picking: the best suggestion if there is one, else the text as typed.
        if (items[0] && searched === query) choose(items[0])
        else onSubmit(query)
      }}
      className="flex w-full flex-col gap-2 sm:flex-row"
    >
      <label htmlFor="business-query" className="sr-only">
        Your restaurant name
      </label>
      <div className="relative flex-1">
        <IconSearch className="pointer-events-none absolute start-3.5 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" aria-hidden="true" />
        <input
          id="business-query"
          type="text"
          role="combobox"
          aria-expanded={showList && items.length > 0}
          aria-controls={listId}
          aria-autocomplete="list"
          aria-activedescendant={active >= 0 ? `${listId}-${active}` : undefined}
          value={value}
          onChange={(e) => {
            onValueChange(e.target.value)
            setOpen(true)
          }}
          onFocus={() => setOpen(true)}
          onBlur={() => setTimeout(() => setOpen(false), 120)}
          onKeyDown={onKeyDown}
          autoFocus
          autoComplete="off"
          enterKeyHint="search"
          placeholder="Your restaurant name"
          className="h-12 w-full rounded-xl border bg-card ps-10 pe-4 text-touch text-foreground outline-none placeholder:text-muted-foreground focus-visible:border-ring focus-visible:ring-3 focus-visible:ring-focus-ring"
        />
        {showList && (items.length > 0 || empty) ? (
          <ul
            id={listId}
            role="listbox"
            className="absolute inset-x-0 top-[calc(100%+0.375rem)] z-30 overflow-hidden rounded-xl border bg-card text-left shadow-lg"
          >
            {items.map((p, i) => (
              <li
                key={p.placeId}
                id={`${listId}-${i}`}
                role="option"
                aria-selected={i === active}
                // mousedown fires before the input blur, so the click is not lost
                onMouseDown={(e) => {
                  e.preventDefault()
                  choose(p)
                }}
                onMouseEnter={() => setActive(i)}
                className={`flex cursor-pointer items-start gap-3 px-4 py-3 ${i === active ? "bg-secondary" : ""}`}
              >
                <IconMapPin className="mt-0.5 size-4 shrink-0 text-muted-foreground" aria-hidden="true" />
                <span className="min-w-0">
                  <span className="block truncate font-medium">{p.name}</span>
                  <span className="block truncate text-sm text-muted-foreground">{p.detail}</span>
                </span>
              </li>
            ))}
            {empty ? (
              <li role="presentation" className="px-4 py-3 text-sm text-muted-foreground">
                Business not found. Try another name or paste its Instagram @.
              </li>
            ) : null}
          </ul>
        ) : null}
      </div>
      <Button type="submit" size="lg" className="h-12 rounded-xl px-6 text-base" disabled={disabled || !query}>
        Analyze
      </Button>
    </form>
  )
}
