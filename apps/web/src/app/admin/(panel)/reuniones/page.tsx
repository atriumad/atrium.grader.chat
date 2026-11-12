import { Suspense } from "react"
import { connection } from "next/server"
import Link from "next/link"

import { BookingActions } from "@/components/admin/booking-actions"
import { Card, PageHeader, PanelSkeleton } from "@/components/admin/ui"
import { STATUS_LABEL, type BookingRecord, type BookingStatus } from "@/lib/admin/bookings"
import { bookingConfig } from "@/lib/booking"
import { db } from "@/lib/supabase/server"
import { assertAdmin } from "@/lib/supabase/auth"

const TABS = [
  { id: "upcoming", label: "Upcoming" },
  { id: "followup", label: "To follow up" },
  { id: "completed", label: "Completed" },
  { id: "cancelled", label: "Cancelled" },
  { id: "all", label: "All" },
] as const
type Tab = (typeof TABS)[number]["id"]

const DOT: Record<BookingStatus, string> = { scheduled: "bg-amber-500", completed: "bg-emerald-500", cancelled: "bg-muted-foreground/50" }

type Sp = { q?: string; tab?: string }

function matches(b: BookingRecord, tab: Tab, now: number): boolean {
  const past = new Date(b.end_at).getTime() < now
  if (tab === "upcoming") return b.status === "scheduled" && !past
  // Scheduled and already over: nobody marked it completed or cancelled yet.
  if (tab === "followup") return b.status === "scheduled" && past
  if (tab === "completed") return b.status === "completed"
  if (tab === "cancelled") return b.status === "cancelled"
  return true
}

async function MeetingsContent({ searchParams }: { searchParams: Promise<Sp> }) {
  await connection()
  await assertAdmin()
  const sp = await searchParams
  const tz = bookingConfig().timezone
  const q = (sp.q ?? "").trim().slice(0, 100).toLowerCase()
  const tab: Tab = TABS.some((t) => t.id === sp.tab) ? (sp.tab as Tab) : "upcoming"

  const { data, error } = await db().from("bookings").select("*").order("start_at", { ascending: false }).limit(500)
  if (error) {
    return <p role="alert" className="text-sm text-destructive text-pretty">I could not read the meetings ({error.message}). Has migration 0005 been applied?</p>
  }
  const all = (data ?? []) as BookingRecord[]
  const now = Date.now()
  const counts = Object.fromEntries(TABS.map((t) => [t.id, all.filter((b) => matches(b, t.id, now)).length])) as Record<Tab, number>
  let rows = all.filter((b) => matches(b, tab, now))
  if (q) rows = rows.filter((b) => [b.name, b.email, b.business_name, b.phone ?? ""].some((v) => v.toLowerCase().includes(q)))
  // Upcoming reads soonest-first; everything else newest-first.
  if (tab === "upcoming") rows = [...rows].reverse()

  const day = new Intl.DateTimeFormat("en-US", { timeZone: tz, weekday: "short", month: "short", day: "numeric" })
  const time = new Intl.DateTimeFormat("en-US", { timeZone: tz, hour: "numeric", minute: "2-digit" })
  const stamp = new Intl.DateTimeFormat("en-US", { dateStyle: "medium", timeStyle: "short" })
  const href = (over: Partial<Sp>) => {
    const p = new URLSearchParams()
    const next = { q: sp.q ?? "", tab, ...over }
    if (next.q) p.set("q", next.q)
    if (next.tab && next.tab !== "upcoming") p.set("tab", next.tab)
    const s = p.toString()
    return `/admin/reuniones${s ? `?${s}` : ""}`
  }
  const chip = (on: boolean) => `rounded-full border px-3 py-1 text-xs transition-colors ${on ? "bg-foreground text-background" : "text-muted-foreground hover:bg-secondary/60"}`

  return (
    <div className="flex flex-col gap-4">
      <div className="flex flex-wrap items-center gap-2">
        <form action="/admin/reuniones" className="flex-1 basis-56">
          <input type="hidden" name="tab" value={tab === "upcoming" ? "" : tab} />
          <label htmlFor="meet-q" className="sr-only">Search meetings</label>
          <input
            id="meet-q"
            name="q"
            defaultValue={sp.q ?? ""}
            placeholder="Search by name, email, phone or business"
            className="h-9 w-full rounded-md border bg-background px-3 text-sm outline-none focus-visible:ring-3 focus-visible:ring-ring/30"
          />
        </form>
        {TABS.map((t) => (
          <Link key={t.id} href={href({ tab: t.id })} className={chip(tab === t.id)}>
            {t.label} <span className="tnum opacity-70">{counts[t.id]}</span>
          </Link>
        ))}
      </div>

      {rows.length === 0 ? (
        <Card>
          <p className="text-sm text-muted-foreground">
            {q ? "No meeting matches that search." : tab === "all" ? "No meetings booked yet." : "Nothing in this view."}
          </p>
        </Card>
      ) : (
        <ul className="flex flex-col gap-2.5">
          {rows.map((b) => {
            const start = new Date(b.start_at)
            return (
              <li key={b.id}>
                <details className="group overflow-hidden rounded-2xl border bg-card">
                  <summary className="flex cursor-pointer list-none flex-wrap items-center gap-x-4 gap-y-1 px-4 py-3 marker:hidden hover:bg-secondary/40 sm:px-5 [&::-webkit-details-marker]:hidden">
                    <span className="w-28 shrink-0 text-sm tnum">
                      <span className="block font-medium">{day.format(start)}</span>
                      <span className="text-xs text-muted-foreground">{time.format(start)}</span>
                    </span>
                    <span className="min-w-0 flex-1 basis-40">
                      <span className="block truncate text-sm font-medium">{b.business_name}</span>
                      <span className="block truncate text-xs text-muted-foreground">{b.name} · {b.email}</span>
                    </span>
                    {b.provider === "mock" ? <span className="rounded-full border px-2 py-0.5 text-[0.6875rem] text-muted-foreground">Test</span> : null}
                    {b.internal_notes ? <span className="text-xs text-muted-foreground" title="Has internal notes">Notes</span> : null}
                    <span className="inline-flex items-center gap-1.5 text-xs">
                      <span className={`size-2 rounded-full ${DOT[b.status]}`} aria-hidden="true" />
                      {STATUS_LABEL[b.status]}
                    </span>
                  </summary>

                  <div className="grid gap-5 border-t px-4 py-4 sm:px-5 md:grid-cols-2">
                    <dl className="grid grid-cols-[auto_1fr] gap-x-4 gap-y-1.5 text-sm">
                      <dt className="text-muted-foreground">Client</dt>
                      <dd>{b.name}</dd>
                      <dt className="text-muted-foreground">Email</dt>
                      <dd><a className="underline underline-offset-2" href={`mailto:${b.email}`}>{b.email}</a></dd>
                      {b.phone ? (<><dt className="text-muted-foreground">Phone</dt><dd className="tnum"><a className="underline underline-offset-2" href={`tel:${b.phone}`}>{b.phone}</a></dd></>) : null}
                      <dt className="text-muted-foreground">Business</dt>
                      <dd>
                        <Link className="underline underline-offset-2" href={`/admin/analisis?q=${encodeURIComponent(b.business_name)}`}>{b.business_name}</Link>
                        {b.score != null ? <span className="text-muted-foreground tnum"> · Score {b.score}</span> : null}
                      </dd>
                      {b.notes ? (<><dt className="text-muted-foreground">Client note</dt><dd className="text-pretty">{b.notes}</dd></>) : null}
                      {b.meet_link ? (<><dt className="text-muted-foreground">Meet</dt><dd><a className="underline underline-offset-2" href={b.meet_link} target="_blank" rel="noreferrer">Open video call</a></dd></>) : null}
                      <dt className="text-muted-foreground">Booked</dt>
                      <dd className="tnum">{stamp.format(new Date(b.created_at))}</dd>
                      <dt className="text-muted-foreground">Emails</dt>
                      <dd className="text-xs">
                        {b.email_visitor === null ? (
                          "Not sent"
                        ) : (
                          <>
                            Client {b.email_visitor ? "sent" : "failed"} · Team {b.email_ops ? "sent" : "failed"}
                            {b.email_error ? <span className="block text-destructive">{b.email_error}</span> : null}
                          </>
                        )}
                      </dd>
                      {b.updated_at ? (<><dt className="text-muted-foreground">Last change</dt><dd className="text-xs text-muted-foreground tnum">{stamp.format(new Date(b.updated_at))}{b.updated_by ? ` · ${b.updated_by}` : ""}</dd></>) : null}
                    </dl>
                    <BookingActions id={b.id} status={b.status} notes={b.internal_notes ?? ""} />
                  </div>
                </details>
              </li>
            )
          })}
        </ul>
      )}
      <p className="text-xs text-muted-foreground">Times are shown in {tz.replace("_", " ")}.</p>
    </div>
  )
}

export default function MeetingsPage({ searchParams }: { searchParams: Promise<Sp> }) {
  return (
    <>
      <PageHeader title="Meetings">
        Every meeting booked from the chat, with the client's details. Mark them as completed or cancelled and keep internal notes. Cancelling also deletes the calendar event.
      </PageHeader>
      <Suspense fallback={<PanelSkeleton label="Loading meetings" className="h-96" />}>
        <MeetingsContent searchParams={searchParams} />
      </Suspense>
    </>
  )
}
