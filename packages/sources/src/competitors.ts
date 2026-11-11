import type { Entity } from "@atrium/shared/types"

// Several locations of one brand usually share the same social accounts. Counting each
// location as a separate competitor repeats the same numbers and skews the average.

export function hasAccounts(e: Entity): boolean {
  return Boolean(e.instagram) || Boolean(e.networks?.length)
}

function accountKeys(e: Entity): string[] {
  const keys: string[] = []
  if (e.instagram) keys.push(`instagram:${e.instagram.handle.toLowerCase()}`)
  for (const n of e.networks ?? []) keys.push(`${n.network}:${n.handle.toLowerCase()}`)
  return keys
}

export type Grouped = {
  competitors: Entity[]
  sameBrandAsBusiness: number // locations dropped because they share accounts with the business
  merged: number // locations folded into another competitor
}

// Keeps the first entity of each account group. Locations of the business itself are dropped.
export function groupByAccount(business: Entity, competitors: Entity[]): Grouped {
  const mine = new Set(accountKeys(business))
  const seen = new Map<string, number>() // account key -> index in `kept`
  const kept: Entity[] = []
  const locations: number[] = []
  let sameBrandAsBusiness = 0
  let merged = 0

  for (const c of competitors) {
    const keys = accountKeys(c)
    if (keys.some((k) => mine.has(k))) {
      sameBrandAsBusiness++
      continue
    }
    const hit = keys.map((k) => seen.get(k)).find((i) => i !== undefined)
    if (hit !== undefined) {
      locations[hit]++
      merged++
      continue
    }
    keys.forEach((k) => seen.set(k, kept.length))
    kept.push(c)
    locations.push(1)
  }

  return {
    competitors: kept.map((c, i) => (locations[i] > 1 ? { ...c, name: `${c.name} · ${locations[i]} locations` } : c)),
    sameBrandAsBusiness,
    merged,
  }
}

export function groupNote(g: Grouped): string {
  const parts: string[] = []
  if (g.merged) parts.push(`locations merged for sharing accounts: ${g.merged}`)
  if (g.sameBrandAsBusiness) parts.push(`locations of the same brand excluded from competitors: ${g.sameBrandAsBusiness}`)
  return parts.length ? ` (${parts.join("; ")})` : ""
}
