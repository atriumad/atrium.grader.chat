import { Suspense } from "react"
import { connection } from "next/server"

import { PageHeader, PanelSkeleton } from "@/components/admin/ui"
import { ScoringEditor } from "@/components/admin/scoring-editor"
import { configHistory, getScoring } from "@/lib/admin/config"
import { DEFAULT_SCORE_CONFIG, serializeScoreConfig } from "@/lib/metrics"
import { db } from "@/lib/supabase/server"
import { assertAdmin } from "@/lib/supabase/auth"

async function ScoringContent() {
  await connection() // read the database per request, never at build time
  await assertAdmin()
  const [cur, history, samples] = await Promise.all([
    getScoring(true),
    configHistory("scoring"),
    db().from("analyses").select("id, created_at, business_name, dataset").order("created_at", { ascending: false }).limit(12),
  ])
  return (
    <>
      <ScoringEditor
        published={serializeScoreConfig(cur.config) as never}
        defaults={serializeScoreConfig(DEFAULT_SCORE_CONFIG) as never}
        custom={cur.custom}
        updatedAt={cur.updatedAt}
        updatedBy={cur.updatedBy}
        history={history.map((h) => ({ id: h.id, value: h.value as never, note: h.note, at: h.created_at, by: h.created_by }))}
        samples={(samples.data ?? []).map((s) => ({ id: s.id as string, name: s.business_name as string, at: s.created_at as string, dataset: s.dataset as never }))}
      />
    </>
  )
}

export default function ScoringPage() {
  return (
    <>
      <PageHeader title="Score rules">
        Define how the Atrium Score is calculated. When you publish, new analyses on the web and in the app use these rules; existing ones keep theirs. Before publishing you can preview how real analyses would change.
      </PageHeader>
      <Suspense fallback={<PanelSkeleton />}>
        <ScoringContent />
      </Suspense>
    </>
  )
}
