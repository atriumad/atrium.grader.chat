import * as React from "react"

// Minimal markdown for the analysis: ## headings, paragraphs, - bullets,
// 1. numbered actions, **bold** and *italic*. Safe with partial streamed text.

function inline(text: string): React.ReactNode[] {
  const out: React.ReactNode[] = []
  const re = /(\*\*[^*]+\*\*|\*[^*\s][^*]*\*)/g
  let last = 0
  let m: RegExpExecArray | null
  let i = 0
  while ((m = re.exec(text))) {
    if (m.index > last) out.push(text.slice(last, m.index))
    const tok = m[0]
    out.push(
      tok.startsWith("**") ? (
        <strong key={i++} className="font-semibold">{tok.slice(2, -2)}</strong>
      ) : (
        <em key={i++}>{tok.slice(1, -1)}</em>
      )
    )
    last = m.index + tok.length
  }
  if (last < text.length) out.push(text.slice(last))
  return out
}

type Block =
  | { t: "h"; text: string }
  | { t: "p"; text: string }
  | { t: "ul"; items: string[] }
  | { t: "ol"; items: string[] }

function parse(src: string): Block[] {
  const blocks: Block[] = []
  for (const raw of src.split("\n")) {
    const line = raw.trimEnd()
    if (!line.trim()) {
      blocks.push({ t: "p", text: "" })
      continue
    }
    const h = line.match(/^#{1,4}\s+(.*)$/)
    const ol = line.match(/^\s*\d+[.)]\s+(.*)$/)
    const ul = line.match(/^\s*[-*•]\s+(.*)$/)
    const prev = blocks[blocks.length - 1]
    if (h) blocks.push({ t: "h", text: h[1] })
    else if (ol) {
      if (prev?.t === "ol") prev.items.push(ol[1])
      else blocks.push({ t: "ol", items: [ol[1]] })
    } else if (ul) {
      if (prev?.t === "ul") prev.items.push(ul[1])
      else blocks.push({ t: "ul", items: [ul[1]] })
    } else if (prev?.t === "p" && prev.text) prev.text += " " + line.trim()
    else blocks.push({ t: "p", text: line.trim() })
  }
  return blocks.filter((b) => !(b.t === "p" && !b.text))
}

export function Prose({ text, streaming = false }: { text: string; streaming?: boolean }) {
  const blocks = parse(text)
  return (
    <div className="flex max-w-none flex-col gap-2.5 text-sm/relaxed" aria-live="polite" aria-busy={streaming}>
      {blocks.map((b, i) => {
        const isLast = i === blocks.length - 1
        const caret =
          streaming && isLast ? (
            <span aria-hidden="true" className="ms-0.5 inline-block h-4 w-1.5 translate-y-0.5 rounded-xs bg-brand motion-safe:animate-pulse" />
          ) : null
        if (b.t === "h")
          return (
            <h3 key={i} className="mt-3 font-display text-lg leading-snug text-balance first:mt-0">
              {inline(b.text)}
              {caret}
            </h3>
          )
        if (b.t === "ul")
          return (
            <ul key={i} className="flex list-disc flex-col gap-1.5 pl-5 marker:text-muted-foreground">
              {b.items.map((it, j) => (
                <li key={j}>
                  {inline(it)}
                  {isLast && j === b.items.length - 1 ? caret : null}
                </li>
              ))}
            </ul>
          )
        if (b.t === "ol")
          return (
            <ol key={i} className="flex flex-col gap-2">
              {b.items.map((it, j) => (
                <li key={j} className="grid grid-cols-[1.75rem_1fr] items-baseline gap-2 rounded-xl border bg-card px-3.5 py-2.5">
                  <span className="font-display text-xl leading-none text-brand tnum">{j + 1}</span>
                  <span>
                    {inline(it)}
                    {isLast && j === b.items.length - 1 ? caret : null}
                  </span>
                </li>
              ))}
            </ol>
          )
        return (
          <p key={i} className="text-pretty">
            {inline(b.text)}
            {caret}
          </p>
        )
      })}
    </div>
  )
}
