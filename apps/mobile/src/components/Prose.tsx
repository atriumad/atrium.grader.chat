import { StyleSheet, Text, View } from "react-native"
import type { ReactNode } from "react"

import { colors, fonts, radius } from "@/theme"

// Minimal markdown for the analysis: ## headings, paragraphs, - bullets, 1. numbered
// actions, **bold** and *italic*. Safe with partial streamed text.

function inline(text: string): ReactNode[] {
  const out: ReactNode[] = []
  const re = /(\*\*[^*]+\*\*|\*[^*\s][^*]*\*)/g
  let last = 0
  let i = 0
  let m: RegExpExecArray | null
  while ((m = re.exec(text))) {
    if (m.index > last) out.push(text.slice(last, m.index))
    const tok = m[0]
    out.push(
      tok.startsWith("**") ? (
        <Text key={i++} style={styles.bold}>
          {tok.slice(2, -2)}
        </Text>
      ) : (
        <Text key={i++} style={styles.italic}>
          {tok.slice(1, -1)}
        </Text>
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
    <View style={{ gap: 12 }} accessibilityLiveRegion="polite">
      {blocks.map((b, i) => {
        const isLast = i === blocks.length - 1
        const caret = streaming && isLast ? <Text style={styles.caret}> ▍</Text> : null
        if (b.t === "h")
          return (
            <Text key={i} style={[styles.h, i > 0 && { marginTop: 8 }]}>
              {inline(b.text)}
              {caret}
            </Text>
          )
        if (b.t === "ul")
          return (
            <View key={i} style={{ gap: 8 }}>
              {b.items.map((it, j) => (
                <View key={j} style={styles.li}>
                  <Text style={styles.bullet}>•</Text>
                  <Text style={[styles.body, { flex: 1 }]}>
                    {inline(it)}
                    {isLast && j === b.items.length - 1 ? caret : null}
                  </Text>
                </View>
              ))}
            </View>
          )
        if (b.t === "ol")
          return (
            <View key={i} style={{ gap: 10 }}>
              {b.items.map((it, j) => (
                <View key={j} style={styles.action}>
                  <Text style={styles.actionNum}>{j + 1}</Text>
                  <Text style={[styles.body, { flex: 1 }]}>
                    {inline(it)}
                    {isLast && j === b.items.length - 1 ? caret : null}
                  </Text>
                </View>
              ))}
            </View>
          )
        return (
          <Text key={i} style={styles.body}>
            {inline(b.text)}
            {caret}
          </Text>
        )
      })}
    </View>
  )
}

const styles = StyleSheet.create({
  body: { fontFamily: fonts.regular, fontSize: 15, lineHeight: 23, color: colors.foreground },
  bold: { fontFamily: fonts.semibold },
  italic: { fontFamily: fonts.regular, fontStyle: "italic" },
  h: { fontFamily: fonts.display, fontSize: 21, lineHeight: 27, color: colors.foreground },
  li: { flexDirection: "row", gap: 10 },
  bullet: { fontFamily: fonts.regular, fontSize: 15, lineHeight: 23, color: colors.mutedForeground, width: 10 },
  action: {
    flexDirection: "row",
    gap: 12,
    backgroundColor: colors.card,
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: radius.md,
    paddingHorizontal: 14,
    paddingVertical: 12,
  },
  actionNum: { fontFamily: fonts.display, fontSize: 22, lineHeight: 26, color: colors.brand, width: 20 },
  caret: { color: colors.brand },
})
