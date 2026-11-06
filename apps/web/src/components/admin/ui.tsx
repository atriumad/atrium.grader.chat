import * as React from "react"

export function PageHeader({ title, children }: { title: string; children?: React.ReactNode }) {
  return (
    <header className="flex flex-col gap-1.5 pb-6">
      <h1 className="font-display text-3xl leading-tight text-balance">{title}</h1>
      {children ? <p className="max-w-[68ch] text-sm text-muted-foreground text-pretty">{children}</p> : null}
    </header>
  )
}

export function Card({ title, hint, children, className = "" }: { title?: string; hint?: string; children: React.ReactNode; className?: string }) {
  return (
    <section className={`overflow-hidden rounded-2xl border bg-card ${className}`}>
      {title ? (
        <header className="border-b px-4 py-3 sm:px-5">
          <h2 className="text-sm font-medium">{title}</h2>
          {hint ? <p className="mt-0.5 text-xs text-muted-foreground text-pretty">{hint}</p> : null}
        </header>
      ) : null}
      <div className="p-4 sm:p-5">{children}</div>
    </section>
  )
}

export function Stat({ label, value, sub }: { label: string; value: React.ReactNode; sub?: React.ReactNode }) {
  return (
    <div className="flex flex-col gap-1 rounded-2xl border bg-card p-4">
      <span className="text-xs text-muted-foreground">{label}</span>
      <span className="font-display text-3xl leading-none tnum">{value}</span>
      {sub ? <span className="text-xs text-muted-foreground tnum">{sub}</span> : null}
    </div>
  )
}

export const inputCls =
  "h-9 w-full rounded-md border bg-background px-2.5 text-sm tnum outline-none transition-shadow focus-visible:ring-3 focus-visible:ring-ring/30 disabled:opacity-50"
export const textareaCls =
  "min-h-28 w-full resize-y rounded-md border bg-background px-3 py-2 text-sm/relaxed outline-none transition-shadow focus-visible:ring-3 focus-visible:ring-ring/30"
