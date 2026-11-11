import { Suspense } from "react"
import { connection } from "next/server"

import { Card, PageHeader, PanelSkeleton, Stat } from "@/components/admin/ui"
import { GOOGLE_PRICE_PER_1000, getApifyUsage, type ApifyUsage } from "@/lib/admin/costs"
import { db } from "@/lib/supabase/server"
import { assertAdmin } from "@/lib/supabase/auth"

const usd = (n: number) => `$${n < 10 ? n.toFixed(2) : n.toFixed(0)}`
const usd3 = (n: number) => `$${n.toFixed(3)}`
const nf = new Intl.NumberFormat("en-US")
const day = (iso: string) => new Intl.DateTimeFormat("en-US", { day: "numeric", month: "short" }).format(new Date(iso))

async function CostsContent() {
  await connection()
  await assertAdmin()
  const cycleStartGuess = new Date(Date.now() - 30 * 86_400_000).toISOString()
  let apify: ApifyUsage | null = null
  let apifyError: string | null = null
  try {
    apify = await getApifyUsage()
  } catch (e) {
    apifyError = e instanceof Error ? e.message : "error"
  }
  const since = apify?.cycleStart ?? cycleStartGuess
  const [calls, analyses] = await Promise.all([
    db().from("events").select("meta").eq("kind", "places_call").gte("created_at", since).limit(20000),
    db().from("analyses").select("id", { count: "exact", head: true }).gte("created_at", since),
  ])
  const counts: Record<string, number> = {}
  for (const r of calls.data ?? []) {
    const sku = (r.meta as { sku?: string } | null)?.sku
    if (sku) counts[sku] = (counts[sku] ?? 0) + 1
  }
  const googleRows = Object.entries(GOOGLE_PRICE_PER_1000).map(([sku, p]) => ({ ...p, sku, n: counts[sku] ?? 0, cost: ((counts[sku] ?? 0) * p.usd) / 1000 }))
  const googleUsd = googleRows.reduce((a, r) => a + r.cost, 0)
  const n = analyses.count ?? 0
  const pct = apify ? Math.min(100, (apify.usedUsd / apify.limitUsd) * 100) : 0
  const left = apify ? apify.limitUsd - apify.usedUsd : 0
  const total = (apify?.usedUsd ?? 0) + googleUsd

  return (
    <>
      <div className="flex flex-col gap-6">
        <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
          <Stat label="Cycle spend" value={usd(total)} sub={apify ? `${day(apify.cycleStart)} – ${day(apify.cycleEnd)}` : "last 30 days"} />
          <Stat label="Per analysis" value={n ? usd3(total / n) : "—"} sub={`${nf.format(n)} ${n === 1 ? "analysis" : "analyses"} this cycle`} />
          <Stat label="Apify (actual)" value={apify ? usd(apify.usedUsd) : "—"} sub={apify ? `${nf.format(apify.runs)} runs · ${usd(apify.last7dUsd)} last 7 d` : "not connected"} />
          <Stat label="Google (estimated)" value={usd(googleUsd)} sub={`${nf.format(Object.values(counts).reduce((a, b) => a + b, 0))} calls`} />
        </div>

        <Card title="Apify: monthly cap" hint="When the cap is reached, social lookups stop working until the next cycle.">
          {apify ? (
            <div className="flex flex-col gap-3">
              <div className="flex items-baseline justify-between text-sm tnum">
                <span><span className="font-display text-2xl">{usd(apify.usedUsd)}</span> <span className="text-muted-foreground">of {usd(apify.limitUsd)}</span></span>
                <span className={left < apify.limitUsd * 0.2 ? "font-medium text-destructive" : "text-muted-foreground"}>
                  {usd(Math.max(0, left))} left{n && apify.usedUsd ? ` · ≈ ${nf.format(Math.floor(Math.max(0, left) / (apify.usedUsd / n)))} more analyses` : ""}
                </span>
              </div>
              <div className="h-2 rounded-full bg-muted" role="img" aria-label={`${Math.round(pct)}% of the cap used`}>
                <div className={`h-full rounded-full ${pct >= 80 ? "bg-destructive" : pct >= 60 ? "bg-amber-500" : "bg-foreground"}`} style={{ width: `${pct}%` }} />
              </div>
              <p className="text-xs text-muted-foreground">The cycle resets on {day(apify.cycleEnd)}. The projection uses this cycle's average cost per analysis.</p>
            </div>
          ) : (
            <p role="alert" className="text-sm text-destructive text-pretty">
              {apifyError ? `I could not read Apify (${apifyError}).` : "APIFY_TOKEN is missing on the server."}
            </p>
          )}
        </Card>

        {apify ? (
          <Card title="Apify by tool" hint="Which actor spends the most. A run is one read of an account or page.">
            <div className="-mx-4 -my-4 overflow-x-auto sm:-mx-5 sm:-my-5">
              <table className="w-full min-w-[480px] border-collapse text-sm">
                <thead>
                  <tr className="text-left text-xs text-muted-foreground">
                    <th className="px-4 py-2.5 font-normal sm:px-5">Actor</th>
                    <th className="px-2 py-2.5 text-right font-normal">Runs</th>
                    <th className="px-2 py-2.5 text-right font-normal">Per run</th>
                    <th className="px-4 py-2.5 text-right font-normal sm:px-5">Spend</th>
                  </tr>
                </thead>
                <tbody>
                  {apify.byActor.map((a) => (
                    <tr key={a.actor} className="border-t">
                      <td className="px-4 py-2.5 sm:px-5">{a.actor}</td>
                      <td className="px-2 py-2.5 text-right tnum">{nf.format(a.runs)}</td>
                      <td className="px-2 py-2.5 text-right tnum">{usd3(a.usd / a.runs)}</td>
                      <td className="px-4 py-2.5 text-right font-medium tnum sm:px-5">{usd(a.usd)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </Card>
        ) : null}

        <Card title="Google Places (estimated)" hint="List price per 1,000 calls, without subtracting Google's free allowance. Calls are counted from this deployment on.">
          <div className="-mx-4 -my-4 overflow-x-auto sm:-mx-5 sm:-my-5">
            <table className="w-full min-w-[480px] border-collapse text-sm">
              <thead>
                <tr className="text-left text-xs text-muted-foreground">
                  <th className="px-4 py-2.5 font-normal sm:px-5">Call</th>
                  <th className="px-2 py-2.5 text-right font-normal">Count</th>
                  <th className="px-2 py-2.5 text-right font-normal">Per 1,000</th>
                  <th className="px-4 py-2.5 text-right font-normal sm:px-5">Estimated</th>
                </tr>
              </thead>
              <tbody>
                {googleRows.map((r) => (
                  <tr key={r.sku} className="border-t">
                    <td className="px-4 py-2.5 sm:px-5">{r.label}</td>
                    <td className="px-2 py-2.5 text-right tnum">{nf.format(r.n)}</td>
                    <td className="px-2 py-2.5 text-right text-muted-foreground tnum">{usd(r.usd)}</td>
                    <td className="px-4 py-2.5 text-right font-medium tnum sm:px-5">{usd(r.cost)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </Card>
      </div>
    </>
  )
}

export default function Costs() {
  return (
    <>
      <PageHeader title="Costs">
        Spend for the current cycle across both providers. Apify is the real figure from its account; Google is an estimate based on counted calls.
      </PageHeader>
      <Suspense fallback={<CostsSkeleton />}>
        <CostsContent />
      </Suspense>
    </>
  )
}

function CostsSkeleton() {
  return (
    <div className="flex flex-col gap-6">
      <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
        {[0, 1, 2, 3].map((i) => (
          <PanelSkeleton key={i} label="Loading costs" className="h-24" />
        ))}
      </div>
      <PanelSkeleton label="Loading costs" className="h-40" />
    </div>
  )
}
