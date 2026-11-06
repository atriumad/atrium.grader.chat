import Anthropic from "@anthropic-ai/sdk"
import type { Place } from "./places"
import type { InstagramStats } from "./socials"
import { streamViaClaudeCli } from "./claude-cli"
import { CONFIDENCE_LABEL, SCORE_CONFIG, TIER_LABEL, scoreAll } from "./metrics"

import type { Dataset, Entity } from "@atrium/shared/types"
export type { Dataset, Entity }

const SYSTEM = `Eres el analista de marketing de una agencia que trabaja con restaurantes.
Recibes datos reales de un negocio y de sus competidores locales: Google (rating, reseñas) e Instagram (seguidores, engagement, frecuencia de publicación).
Responde SIEMPRE en español, en texto claro para un dueño de restaurante, sin jerga.

Reglas:
- La pantalla ya muestra qué negocio se identificó, no lo repitas. Solo si el nombre consultado ("queried") y el negocio encontrado difieren claramente, avísalo en una línea y sugiere probar con el @ de Instagram.
- Si "place" es null, no hay datos de Google: no hables de rating ni reseñas.
- "competitorsSource" explica de dónde salen los competidores. Si son cuentas sugeridas por Instagram, adviértelo: pueden no ser competidores directos.
- Usa solo los datos recibidos. No inventes cifras. Si falta un dato (por ejemplo, un competidor sin Instagram), dilo.
- Los datos de Instagram vienen de una muestra de los últimos posts públicos; menciónalo si afecta la conclusión.
- Compara siempre al negocio contra el promedio y el mejor competidor.
- Si la confianza del negocio analizado es media o baja, di en una frase que el puntaje es provisional y qué datos faltan (campo "sinDatos"); no saques conclusiones fuertes de lo que falta.
- Recibes un "Puntaje Atrium" (0-100) por negocio, ya calculado. Úsalo como el resumen: di en qué puesto queda el negocio y qué partes (reputación, engagement, audiencia, actividad) lo suben o lo bajan. No inventes otro puntaje ni cambies estos números.
- Formato markdown simple, y nada más: encabezados "## ", párrafos cortos, listas con "- " y **negritas** para cifras clave. Sin tablas ni emojis.
- Solo estas tres secciones, en este orden y con estos encabezados exactos: "## Resumen" (2 frases: puesto y la idea principal), "## Qué sube y qué baja tu puntaje" (2 o 3 viñetas con "- ", una por señal relevante, cada una con una cifra y su causa), "## Las 3 acciones que más importan" (lista numerada "1.", "2.", "3."; en cada una, en negrita lo que hay que hacer y después una frase de por qué; ordenadas por impacto).
- El usuario ya ve la tabla, el mapa y las cifras. Interpreta, no las listes: usa como mucho una o dos cifras por viñeta.
- Engagement rate = (likes promedio + comentarios promedio) / seguidores.
- Sé breve: entre 150 y 200 palabras en total.`

function userPrompt(data: Dataset): string {
  const scores = scoreAll(data)
  const puntajes = [data.business, ...data.competitors].map((e, i) => ({
    negocio: e.name,
    esElNegocioAnalizado: i === 0,
    puntaje: scores[i].total,
    nivel: TIER_LABEL[scores[i].tier],
    confianza: CONFIDENCE_LABEL[scores[i].confidence.level],
    sinDatos: scores[i].missing,
    partes: Object.fromEntries(scores[i].parts.map((p) => [p.key, p.score === null ? null : Math.round(p.score)])),
  }))
  const w = SCORE_CONFIG.weights
  return (
    `Datos (JSON):\n${JSON.stringify(data, null, 2)}\n\n` +
    `Puntaje Atrium (0-100). Ponderación: reputación ${w.reputation}%, engagement ${w.engagement}%, audiencia ${w.audience}%, actividad ${w.activity}%. ` +
    `Verde (bueno) desde ${SCORE_CONFIG.tiers.good}, naranja (medio) desde ${SCORE_CONFIG.tiers.medium}, rojo (bajo) por debajo. Una parte en null significa que no hay datos.\n` +
    `${JSON.stringify(puntajes, null, 2)}\n\nAnaliza cómo está el negocio frente a su competencia.`
  )
}

// ANALYSIS_PROVIDER=claude-cli (default): uses your Claude plan through the local CLI.
// ANALYSIS_PROVIDER=api: uses ANTHROPIC_API_KEY. Required if this is served to customers.
export async function* streamAnalysis(data: Dataset): AsyncGenerator<string> {
  if ((process.env.ANALYSIS_PROVIDER ?? "claude-cli") === "api") {
    yield* streamAnalysisApi(data)
  } else {
    yield* streamViaClaudeCli({ system: SYSTEM, prompt: userPrompt(data) })
  }
}

async function* streamAnalysisApi(data: Dataset): AsyncGenerator<string> {
  const apiKey = process.env.ANTHROPIC_API_KEY
  if (!apiKey) throw new Error("Falta ANTHROPIC_API_KEY")
  const client = new Anthropic({ apiKey })

  const stream = client.messages.stream({
    model: process.env.ANTHROPIC_MODEL ?? "claude-sonnet-5-5",
    max_tokens: 1500,
    system: SYSTEM,
    messages: [
      {
        role: "user",
        content: userPrompt(data),
      },
    ],
  })

  for await (const event of stream) {
    if (event.type === "content_block_delta" && event.delta.type === "text_delta") {
      yield event.delta.text
    }
  }
}
