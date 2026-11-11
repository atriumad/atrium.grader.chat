import { Suspense } from "react"
import { connection } from "next/server"

import { AgentEditor } from "@/components/admin/agent-editor"
import { PageHeader, PanelSkeleton } from "@/components/admin/ui"
import { configHistory, getAgent } from "@/lib/admin/config"
import { assertAdmin } from "@/lib/supabase/auth"

async function AgentsContent() {
  await connection() // read the database per request, never at build time
  await assertAdmin()
  const [cur, history] = await Promise.all([getAgent(true), configHistory("agent")])
  return (
    <>
      <AgentEditor
        initial={cur.config}
        custom={cur.custom}
        updatedAt={cur.updatedAt}
        updatedBy={cur.updatedBy}
        history={history.map((h) => ({ id: h.id, value: h.value, note: h.note, at: h.created_at, by: h.created_by }))}
      />
    </>
  )
}

export default function AgentsPage() {
  return (
    <>
      <PageHeader title="Agent behavior">
        Adjust the tone, instructions and tools of the analysis and the chat without touching code. Changes apply to new conversations and analyses.
      </PageHeader>
      <Suspense fallback={<PanelSkeleton />}>
        <AgentsContent />
      </Suspense>
    </>
  )
}
