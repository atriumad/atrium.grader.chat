import { connection } from "next/server"

import { KnowledgeManager } from "@/components/admin/knowledge-manager"
import { PageHeader } from "@/components/admin/ui"
import { listDocs } from "@/lib/admin/knowledge"

export default async function KnowledgePage() {
  await connection() // read the database per request, never at build time
  const docs = await listDocs().catch(() => [])
  return (
    <>
      <PageHeader title="Base de conocimiento">
        Sube lo que quieres que los agentes sepan: servicios, casos de éxito, precios, guías, políticas. El chat lo busca cuando hace falta y los documentos fijados se usan siempre, también en el análisis.
      </PageHeader>
      <KnowledgeManager initial={docs as never} />
    </>
  )
}
