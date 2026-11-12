import * as React from "react"

// Building blocks for the admin documentation page. Static, no data fetching.

export function DocSection({ id, title, lead, children }: { id: string; title: string; lead?: string; children: React.ReactNode }) {
  return (
    <section id={id} aria-labelledby={`${id}-h`} className="scroll-mt-6 border-t pt-8 first:border-t-0 first:pt-0">
      <h2 id={`${id}-h`} className="font-display text-2xl leading-tight text-balance">
        {title}
      </h2>
      {lead ? <p className="mt-2 max-w-[68ch] text-sm/relaxed text-muted-foreground text-pretty">{lead}</p> : null}
      <div className="mt-5 flex flex-col gap-5">{children}</div>
    </section>
  )
}

export function H3({ children }: { children: React.ReactNode }) {
  return <h3 className="text-sm font-medium">{children}</h3>
}

export function P({ children }: { children: React.ReactNode }) {
  return <p className="max-w-[68ch] text-sm/relaxed text-pretty">{children}</p>
}

export function Bullets({ items }: { items: React.ReactNode[] }) {
  return (
    <ul className="flex max-w-[68ch] list-disc flex-col gap-1.5 pl-5 text-sm/relaxed marker:text-muted-foreground">
      {items.map((it, i) => (
        <li key={i}>{it}</li>
      ))}
    </ul>
  )
}

// A vertical flow: numbered steps joined by a line. Reads top to bottom.
export function Flow({ steps }: { steps: Array<{ title: string; text: React.ReactNode }> }) {
  return (
    <ol className="flex flex-col">
      {steps.map((s, i) => (
        <li key={s.title} className="relative flex gap-3 pb-5 last:pb-0">
          {i < steps.length - 1 ? <span aria-hidden="true" className="absolute top-7 bottom-0 left-[0.8125rem] w-px bg-border" /> : null}
          <span
            aria-hidden="true"
            className="z-10 grid size-7 shrink-0 place-items-center rounded-full border bg-card text-xs font-medium tnum"
          >
            {i + 1}
          </span>
          <div className="min-w-0 pt-0.5">
            <p className="text-sm font-medium">{s.title}</p>
            <p className="mt-0.5 max-w-[64ch] text-sm/relaxed text-muted-foreground text-pretty">{s.text}</p>
          </div>
        </li>
      ))}
    </ol>
  )
}

export function Note({ kind = "info", title, children }: { kind?: "info" | "warn"; title: string; children: React.ReactNode }) {
  return (
    <aside className={`max-w-[68ch] rounded-xl border p-3.5 text-sm/relaxed ${kind === "warn" ? "border-[var(--tier-medium)]/50 bg-[color-mix(in_oklab,var(--tier-medium)_10%,transparent)]" : "bg-secondary/50"}`}>
      <p className="font-medium">{title}</p>
      <div className="mt-0.5 text-muted-foreground">{children}</div>
    </aside>
  )
}

export function Table({ head, rows }: { head: string[]; rows: React.ReactNode[][] }) {
  return (
    <div className="overflow-x-auto rounded-xl border">
      <table className="w-full min-w-[32rem] text-left text-sm">
        <thead className="bg-secondary/50 text-xs text-muted-foreground">
          <tr>
            {head.map((h) => (
              <th key={h} scope="col" className="px-3 py-2 font-medium">
                {h}
              </th>
            ))}
          </tr>
        </thead>
        <tbody className="divide-y">
          {rows.map((r, i) => (
            <tr key={i} className="align-top">
              {r.map((c, j) => (
                <td key={j} className={`px-3 py-2 ${j === 0 ? "font-medium whitespace-nowrap" : "text-muted-foreground"}`}>
                  {c}
                </td>
              ))}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  )
}

export function Code({ children }: { children: React.ReactNode }) {
  return <code className="rounded bg-secondary px-1 py-0.5 font-mono text-[0.8125em]">{children}</code>
}
