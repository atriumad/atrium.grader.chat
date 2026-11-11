import { Suspense } from "react"
import { connection } from "next/server"

import { KnowledgeManager } from "@/components/admin/knowledge-manager"
import { PageHeader, PanelSkeleton } from "@/components/admin/ui"
import { listDocs } from "@/lib/admin/knowledge"
import { assertAdmin } from "@/lib/supabase/auth"

async function KnowledgeContent() {
  await connection() // read the database per request, never at build time
  await assertAdmin()
  const docs = await listDocs().catch(() => [])
  return (
    <>
      <KnowledgeManager initial={docs as never} />
    </>
  )
}

export default function KnowledgePage() {
  return (
    <>
      <PageHeader title="Knowledge base">
        Upload what you want the agents to know: services, case studies, prices, guides, policies. The chat searches it when needed, and pinned documents are always used, including in the analysis.
      </PageHeader>
      <Suspense fallback={<PanelSkeleton />}>
        <KnowledgeContent />
      </Suspense>
    </>
  )
}
