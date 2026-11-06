import { PageHeader } from "@/components/admin/ui"
import { ScoringEditor } from "@/components/admin/scoring-editor"
import { configHistory, getScoring } from "@/lib/admin/config"
import { DEFAULT_SCORE_CONFIG, serializeScoreConfig } from "@/lib/metrics"
import { db } from "@/lib/supabase/server"

export default async function ScoringPage() {
  const [cur, history, samples] = await Promise.all([
    getScoring(true),
    configHistory("scoring"),
    db().from("analyses").select("id, created_at, business_name, dataset").order("created_at", { ascending: false }).limit(12),
  ])
  return (
    <>
      <PageHeader title="Reglas del puntaje">
        Define cómo se calcula el Puntaje Atrium. Al publicar, los análisis nuevos de la web y de la app usan estas reglas; los ya hechos conservan las suyas. Antes de publicar puedes ver cómo cambiarían análisis reales.
      </PageHeader>
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
