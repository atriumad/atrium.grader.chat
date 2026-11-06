import type { Place } from "./places"

// Decides whether a Google Places search is clear enough to proceed, or whether
// the user must pick (franchise with several locations) or confirm (typo, weak match).

const STOP = new Set(["the", "a", "an", "de", "del", "la", "el", "los", "las", "y", "and", "en", "in", "of", "at", "e"])

export function tokens(s: string): string[] {
  return s
    .toLowerCase()
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .replace(/[^a-z0-9]+/g, " ")
    .split(" ")
    .filter((t) => t && !STOP.has(t))
}

function lev(a: string, b: string): number {
  const dp = Array.from({ length: a.length + 1 }, (_, i) => [i, ...Array(b.length).fill(0)])
  for (let j = 1; j <= b.length; j++) dp[0][j] = j
  for (let i = 1; i <= a.length; i++) {
    for (let j = 1; j <= b.length; j++) {
      dp[i][j] = Math.min(dp[i - 1][j] + 1, dp[i][j - 1] + 1, dp[i - 1][j - 1] + (a[i - 1] === b[j - 1] ? 0 : 1))
    }
  }
  return dp[a.length][b.length]
}

// Tolerates typos and plurals: "waffle"~"waffles", "chick"~"chicken", "streen"~"screen".
export function fuzzyEq(a: string, b: string): boolean {
  if (a === b) return true
  const min = Math.min(a.length, b.length)
  const max = Math.max(a.length, b.length)
  if (min >= 4 && (a.startsWith(b) || b.startsWith(a))) return true
  return lev(a, b) <= (max >= 7 ? 2 : max >= 4 ? 1 : 0)
}

function share(from: string[], within: string[]): number {
  if (!from.length) return 0
  return from.filter((t) => within.some((w) => fuzzyEq(t, w))).length / from.length
}

// 1 = every word of the name is in the query, or every word of the query is in the name.
// Words of the query may also match the address: the city in "Mothers Bistro Portland".
function score(query: string[], name: string[], address: string[]): { score: number; strong: boolean } {
  const nameInQuery = share(name, query)
  const queryInName = share(query, [...name, ...address])
  const s = Math.max(nameInQuery, queryInName)
  return { score: s, strong: s >= 0.99 }
}

export type Decision =
  | { action: "none" }
  | { action: "proceed"; place: Place }
  | { action: "ask"; reason: "multiple" | "confirm" | "typo"; message: string; options: Place[] }

export function decide(query: string, candidates: Place[]): Decision {
  if (!candidates.length) return { action: "none" }
  const q = tokens(query)
  const scored = candidates
    .map((p) => ({ p, ...score(q, tokens(p.name), tokens(p.address)) }))
    .sort((a, b) => b.score - a.score)
  const top = scored[0]
  const second = scored[1]

  if (top.score < 0.5) {
    return {
      action: "ask",
      reason: "typo",
      message: `No encontré una coincidencia clara con "${query}". ¿Quisiste decir alguno de estos?`,
      options: candidates.slice(0, 5),
    }
  }

  // Several places tie for the best match: same name at different addresses
  // (a franchise), or a typo that fits several branches equally.
  const tied = scored.filter((s) => top.score - s.score <= 0.05)
  if (tied.length >= 2) {
    return {
      action: "ask",
      reason: "multiple",
      message: `Encontré ${tied.length} locales de "${query}". ¿Cuál quieres analizar?`,
      options: tied.map((s) => s.p),
    }
  }

  // One place clearly beats the rest.
  if (top.score >= 0.7 && (!second || top.score - second.score >= 0.2)) {
    return { action: "proceed", place: top.p }
  }

  // A plausible match, but not clear enough to assume.
  return {
    action: "ask",
    reason: "confirm",
    message: `No estoy seguro de que sea el negocio que buscas. ¿Es alguno de estos?`,
    options: scored.filter((s) => s.score >= 0.3).slice(0, 4).map((s) => s.p),
  }
}
