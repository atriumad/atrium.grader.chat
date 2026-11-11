import { Suspense } from "react"
import { connection } from "next/server"
import Link from "next/link"
import { notFound } from "next/navigation"

import { PanelSkeleton } from "@/components/admin/ui"
import { Report } from "@/components/results/report"
import type { Dataset } from "@/lib/analysis"
import { db } from "@/lib/supabase/server"
import { assertAdmin } from "@/lib/supabase/auth"

const when = (iso: string) => new Intl.DateTimeFormat("en-US", { dateStyle: "long", timeStyle: "short" }).format(new Date(iso))

async function AnalysisContent({ params }: { params: Promise<{ id: string }> }) {
  await connection()
  await assertAdmin()
  const { id } = await params
  if (!/^[0-9a-f-]{36}$/i.test(id)) notFound()
  const { data } = await db().from("analyses").select("id, created_at, query, source, duration_ms, score, dataset").eq("id", id).maybeSingle()
  if (!data) notFound()
  const dataset = data.dataset as Dataset

  return (
    <div className="flex flex-col gap-5">
      <div className="flex flex-col gap-2">
        <dl className="flex flex-wrap gap-x-6 gap-y-1 text-xs text-muted-foreground tnum">
          <div className="flex gap-1.5"><dt>Date</dt><dd className="text-foreground">{when(data.created_at)}</dd></div>
          <div className="flex gap-1.5"><dt>Searched</dt><dd className="text-foreground">{data.query}</dd></div>
          <div className="flex gap-1.5"><dt>Source</dt><dd className="text-foreground">{data.source === "mobile" ? "App" : "Web"}</dd></div>
          <div className="flex gap-1.5"><dt>Duration</dt><dd className="text-foreground">{data.duration_ms ? `${Math.round(data.duration_ms / 1000)} s` : "—"}</dd></div>
        </dl>
      </div>
      <Report data={dataset} />
    </div>
  )
}

export default function AnalysisDetail({ params }: { params: Promise<{ id: string }> }) {
  return (
    <div className="flex flex-col gap-3">
      <Link href="/admin/analisis" className="text-sm text-muted-foreground underline-offset-4 hover:text-foreground hover:underline">
        ← All analyses
      </Link>
      <Suspense fallback={<PanelSkeleton label="Loading analysis" className="h-[32rem]" />}>
        <AnalysisContent params={params} />
      </Suspense>
    </div>
  )
}
