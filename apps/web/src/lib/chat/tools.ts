import type Anthropic from "@anthropic-ai/sdk"

import type { AgentConfig } from "@/lib/admin/config"

export const chatTools: Anthropic.Tool[] = [
  {
    name: "get_availability",
    description:
      "Consulta los horarios libres reales del equipo de la agencia para una reunión. Los horarios se muestran al usuario como botones. Úsala antes de proponer una cita; nunca inventes horarios.",
    input_schema: {
      type: "object",
      properties: {
        part_of_day: { type: "string", enum: ["morning", "afternoon", "any"], description: "Preferencia del usuario: mañana, tarde o cualquiera." },
        days_ahead: { type: "integer", minimum: 1, maximum: 14, description: "Cuántos días hacia adelante mirar. Por defecto 14." },
      },
    },
  },
  {
    name: "propose_booking",
    description:
      "Muestra al usuario una tarjeta con la reunión para que la revise y la confirme con un botón. NO agenda nada por sí sola. Necesita un horario devuelto por get_availability, el nombre y el correo del usuario.",
    input_schema: {
      type: "object",
      properties: {
        slot_start: { type: "string", description: "Campo 'start' exacto de un horario devuelto por get_availability." },
        name: { type: "string", description: "Nombre del usuario." },
        email: { type: "string", description: "Correo del usuario." },
        phone: { type: "string", description: "Teléfono, si lo dio." },
        notes: { type: "string", description: "Qué quiere tratar, en una frase, si lo dijo." },
      },
      required: ["slot_start", "name", "email"],
    },
  },
  {
    name: "get_live_social_stats",
    description:
      "Consulta EN VIVO los números de una red social de un negocio (seguidores, engagement, frecuencia, último post) y los compara con lo que tenía el diagnóstico. Úsala para verificar cifras o cuando pregunten por una red concreta. Cuesta una consulta externa: no la repitas sin necesidad.",
    input_schema: {
      type: "object",
      properties: {
        network: { type: "string", enum: ["instagram", "facebook", "tiktok", "youtube"] },
        business: { type: "string", description: "Nombre (o parte) del negocio o competidor. Si se omite, el negocio analizado." },
        handle_or_url: { type: "string", description: "Solo si no está en el diagnóstico: usuario (IG/TikTok) o URL (Facebook/YouTube)." },
      },
      required: ["network"],
    },
  },
  {
    name: "get_live_google_reputation",
    description: "Consulta en vivo la ficha de Google Maps del negocio o de un competidor: rating, número de reseñas y sitio web, comparado con el diagnóstico.",
    input_schema: { type: "object", properties: { business: { type: "string", description: "Nombre del negocio o competidor. Por defecto el analizado." } } },
  },
  {
    name: "audit_website_seo",
    description:
      "Revisa el SEO básico de la portada del sitio web de un negocio del diagnóstico: title, meta descripción, H1, datos estructurados de restaurante, móvil, sitemap, robots, velocidad de respuesta y contenido. Solo funciona con sitios del diagnóstico.",
    input_schema: { type: "object", properties: { business: { type: "string", description: "Nombre del negocio o competidor. Por defecto el analizado." } } },
  },
  {
    name: "check_google_ranking",
    description:
      "Busca en Google una consulta (ej. 'restaurante mexicano en Portland') y dice en qué posición orgánica aparece el sitio del negocio y qué competidores salen. No incluye el mapa local. Cuesta una consulta externa.",
    input_schema: {
      type: "object",
      properties: {
        query: { type: "string", description: "Lo que buscaría un cliente, con ciudad." },
        business: { type: "string", description: "Negocio a localizar. Por defecto el analizado." },
      },
      required: ["query"],
    },
  },
  {
    name: "search_agency_knowledge",
    description:
      "Busca en el material que la agencia subió (servicios, casos de éxito, precios, guías, políticas) y devuelve los fragmentos más relevantes. Úsala para recomendar servicios, citar casos o responder cómo trabaja la agencia. Si no devuelve nada, no inventes: di que no tienes esa información.",
    input_schema: {
      type: "object",
      properties: { query: { type: "string", description: "Qué buscar, en pocas palabras (ej. 'gestión de Instagram para restaurantes')." } },
      required: ["query"],
    },
  },
]

const GROUP: Record<string, keyof AgentConfig["tools"]> = {
  get_availability: "booking",
  propose_booking: "booking",
  get_live_social_stats: "liveSocial",
  get_live_google_reputation: "liveGoogle",
  audit_website_seo: "seo",
  check_google_ranking: "ranking",
  search_agency_knowledge: "knowledge",
}

export function toolEnabled(name: string, tools: AgentConfig["tools"]): boolean {
  const g = GROUP[name]
  return g ? tools[g] : false
}

export function chatToolsFor(tools: AgentConfig["tools"]): Anthropic.Tool[] {
  return chatTools.filter((t) => toolEnabled(t.name, tools))
}
