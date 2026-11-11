// Provider test: runs /api/analyze for each restaurant, one at a time, and measures how complete
// each source's data is. It does NOT judge whether an account is the right business: that column
// is for a person to fill in from the printed handles.
//
//   1. start the app:   npm run dev      (needs GOOGLE_PLACES_API_KEY and SCRAPECREATORS_API_KEY)
//   2. run:             node scripts/provider-test/run.mjs [baseUrl] [pauseSeconds]
//
// Each run spends real provider credits (Google Places + ScrapeCreators) and one writing call.

import { readFile, writeFile, mkdir } from "node:fs/promises"
import { dirname, join } from "node:path"
import { fileURLToPath } from "node:url"

const here = dirname(fileURLToPath(import.meta.url))
const base = process.argv[2] ?? "http://localhost:3000"
const pauseMs = Number(process.argv[3] ?? 20) * 1000

const list = JSON.parse(await readFile(join(here, "restaurants.json"), "utf8"))
const only = (process.env.ONLY ?? "").split("|").filter(Boolean).map((x) => x.toLowerCase())
const todo = list.filter((r) => !r.query.startsWith("TODO") && (!only.length || only.some((o) => r.query.toLowerCase().includes(o))))
console.log(`${todo.length} restaurantes (${list.length - todo.length} sin completar se omiten) · ${base}\n`)

const hasAccounts = (e) => Boolean(e.instagram) || Boolean(e.networks?.length)
const sleep = (ms) => new Promise((r) => setTimeout(r, ms))

async function analyze(query, placeId) {
  const t0 = Date.now()
  const out = { query, steps: [], data: null, choices: null, error: null, ms: 0 }
  try {
    const res = await fetch(`${base}/api/analyze`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(placeId ? { query, placeId } : { query }),
      signal: AbortSignal.timeout(130_000),
    })
    if (!res.ok || !res.body) {
      out.error = `HTTP ${res.status}`
      return out
    }
    const dec = new TextDecoder()
    let buf = ""
    for await (const chunk of res.body) {
      buf += dec.decode(chunk, { stream: true })
      const lines = buf.split("\n")
      buf = lines.pop() ?? ""
      for (const line of lines) {
        if (!line.trim()) continue
        const e = JSON.parse(line)
        if (e.type === "step") out.steps.push({ id: e.id, state: e.state, meta: e.meta ?? null, at: Date.now() - t0 })
        else if (e.type === "data") out.data = e.data
        else if (e.type === "choices") { out.choices = e.options?.map((o) => `${o.name} · ${o.address}`) ?? []; out.choiceIds = e.options?.map((o) => o.id) ?? [] }
        else if (e.type === "error") out.error = e.text
      }
    }
  } catch (e) {
    out.error = e instanceof Error ? e.message : String(e)
  }
  out.ms = Date.now() - t0
  return out
}

function measure(r) {
  const d = r.data
  if (!d) return null
  const b = d.business
  const rivals = d.competitors ?? []
  const rivalsRead = rivals.filter((c) => c.instagram || c.networks?.length)
  return {
    google: {
      listing: Boolean(b.place),
      rating: b.place?.rating ?? null,
      reviews: b.place?.reviews ?? null,
      website: b.place?.website ?? null,
    },
    instagram: {
      found: Boolean(b.instagram),
      handle: b.instagram?.handle ?? null,
      followers: b.instagram?.followers ?? null,
      engagement: b.instagram?.engagementRatePct ?? null,
      postsSampled: b.instagram?.postsSampled ?? 0,
      note: b.instagramNote,
    },
    otherNetworks: (b.networks ?? []).map((n) => `${n.network}:${n.handle}`),
    competitors: { found: rivals.length, withAccounts: rivals.filter(hasAccounts).length, read: rivalsRead.length },
    competitorHandles: rivals.filter(hasAccounts).map((c) => `${c.name} → ${c.instagram?.handle ?? c.networks?.map((n) => `${n.network}:${n.handle}`).join(",")}`),
  }
}

const results = []
for (const [i, item] of todo.entries()) {
  process.stdout.write(`[${i + 1}/${todo.length}] ${item.query} … `)
  let r = await analyze(item.query)
  let autoPicked = null
  if (r.choices?.length && r.choiceIds?.[0]) {
    // `pick` (optional, in restaurants.json) selects the expected location by text.
    const at = item.pick ? r.choices.findIndex((c) => c.toLowerCase().includes(item.pick.toLowerCase())) : -1
    if (at > 0) { r.choices.unshift(...r.choices.splice(at, 1)); r.choiceIds.unshift(...r.choiceIds.splice(at, 1)) }
    // Like a user would: take the first location offered, then run the full analysis.
    autoPicked = r.choices[0]
    process.stdout.write(`(${r.choices.length} sedes → ${autoPicked}) … `)
    const first = r
    r = await analyze(item.query, first.choiceIds[0])
    r.ms += first.ms
    r.allChoices = first.choices
  }
  const m = measure(r)
  results.push({ ...item, ms: r.ms, error: r.error, choices: r.choices, autoPicked, allChoices: r.allChoices ?? null, steps: r.steps, m })
  console.log(r.error ? `ERROR ${r.error}` : r.choices ? `sigue ambiguo (${r.choices.length} opciones)` : `ok ${(r.ms / 1000).toFixed(0)}s`)
  if (i < todo.length - 1) await sleep(pauseMs)
}

// ---- report ----
const pct = (n, d) => (d ? `${Math.round((100 * n) / d)}%` : "—")
const done = results.filter((r) => r.m)
const lines = []
lines.push(`# Prueba de proveedores · ${new Date().toISOString().slice(0, 10)}`, "")
lines.push(`Restaurantes: ${todo.length} · con resultado: ${done.length} · con varias sedes (se eligió la 1.ª): ${results.filter((r) => r.autoPicked).length} · con error: ${results.filter((r) => r.error && !r.m).length}`, "")
lines.push("## Cobertura por fuente", "")
lines.push("| Fuente | Dato completo | Detalle |", "|---|---|---|")
lines.push(`| Google · ficha encontrada | ${pct(done.filter((r) => r.m.google.listing).length, done.length)} | |`)
lines.push(`| Google · rating y reseñas | ${pct(done.filter((r) => r.m.google.rating != null && r.m.google.reviews != null).length, done.length)} | |`)
lines.push(`| Google · sitio web | ${pct(done.filter((r) => r.m.google.website).length, done.length)} | sin web no hay forma de encontrar redes |`)
lines.push(`| Instagram · encontrado | ${pct(done.filter((r) => r.m.instagram.found).length, done.length)} | |`)
lines.push(`| Instagram · con engagement | ${pct(done.filter((r) => r.m.instagram.engagement != null).length, done.length)} | |`)
lines.push(`| Otras redes · al menos una | ${pct(done.filter((r) => r.m.otherNetworks.length).length, done.length)} | |`)
const rivalsTotal = done.reduce((a, r) => a + r.m.competitors.found, 0)
const rivalsAcc = done.reduce((a, r) => a + r.m.competitors.withAccounts, 0)
lines.push(`| Competidores con cuentas | ${pct(rivalsAcc, rivalsTotal)} | ${rivalsAcc} de ${rivalsTotal} |`, "")
const secs = done.map((r) => r.ms / 1000).sort((a, b) => a - b)
if (secs.length) lines.push(`Tiempo: mediana ${secs[Math.floor(secs.length / 2)].toFixed(0)} s · máximo ${secs[secs.length - 1].toFixed(0)} s`, "")
lines.push("## Por restaurante (la última columna la llena una persona)", "")
lines.push("| Consulta | Tamaño | Google | Instagram | Otras redes | Competidores c/cuentas | s | ¿Cuenta correcta? |", "|---|---|---|---|---|---|---|---|")
for (const r of results) {
  if (!r.m) {
    lines.push(`| ${r.query} | ${r.size} | ${r.choices ? "ambiguo: " + r.choices.slice(0, 2).join(" / ") : "ERROR " + r.error} | | | | ${(r.ms / 1000).toFixed(0)} | |`)
    continue
  }
  const g = r.m.google
  lines.push(
    `| ${r.query}${r.autoPicked ? ` (${r.allChoices.length} sedes; 1.ª: ${r.autoPicked})` : ""} | ${r.size} | ${g.listing ? `${g.rating ?? "?"}★ / ${g.reviews ?? "?"}` : "no"} | ${r.m.instagram.found ? "@" + r.m.instagram.handle : "no: " + r.m.instagram.note} | ${r.m.otherNetworks.join(", ") || "—"} | ${r.m.competitors.withAccounts}/${r.m.competitors.found} | ${(r.ms / 1000).toFixed(0)} | |`
  )
}
const outDir = join(here, "out")
await mkdir(outDir, { recursive: true })
const stamp = new Date().toISOString().replace(/[:.]/g, "-").slice(0, 19)
await writeFile(join(outDir, `${stamp}.json`), JSON.stringify(results, null, 2))
await writeFile(join(outDir, `${stamp}.md`), lines.join("\n"))
console.log(`\nResultados en scripts/provider-test/out/${stamp}.md`)
