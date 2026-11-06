import type Anthropic from "@anthropic-ai/sdk"

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
]
