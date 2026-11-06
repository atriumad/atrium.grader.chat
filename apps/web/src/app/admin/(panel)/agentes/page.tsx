import { connection } from "next/server"

import { AgentEditor } from "@/components/admin/agent-editor"
import { PageHeader } from "@/components/admin/ui"
import { configHistory, getAgent } from "@/lib/admin/config"

export default async function AgentsPage() {
  await connection() // read the database per request, never at build time
  const [cur, history] = await Promise.all([getAgent(true), configHistory("agent")])
  return (
    <>
      <PageHeader title="Comportamiento de los agentes">
        Ajusta el tono, las instrucciones y las herramientas del análisis y del chat sin tocar código. Los cambios aplican a las conversaciones y análisis nuevos.
      </PageHeader>
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
