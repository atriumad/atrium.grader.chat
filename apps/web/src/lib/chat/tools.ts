import type Anthropic from "@anthropic-ai/sdk"

import type { AgentConfig } from "@/lib/admin/config"

export const chatTools: Anthropic.Tool[] = [
  {
    name: "get_availability",
    description:
      "Looks up the real free time slots of the agency team for a meeting. The slots are shown to the user as buttons. Use it before proposing an appointment; never invent time slots.",
    input_schema: {
      type: "object",
      properties: {
        part_of_day: { type: "string", enum: ["morning", "afternoon", "any"], description: "User preference: morning, afternoon or any." },
        days_ahead: { type: "integer", minimum: 1, maximum: 14, description: "How many days ahead to look. Default 14." },
      },
    },
  },
  {
    name: "propose_booking",
    description:
      "Shows the user a card with the meeting so they can review it and confirm it with a button. It does NOT book anything by itself. It needs a slot returned by get_availability, and the user's name and email.",
    input_schema: {
      type: "object",
      properties: {
        slot_start: { type: "string", description: "The exact 'start' field of a slot returned by get_availability." },
        name: { type: "string", description: "The user's name." },
        email: { type: "string", description: "The user's email." },
        phone: { type: "string", description: "Phone number, if they gave it." },
        notes: { type: "string", description: "What they want to discuss, in one sentence, if they said." },
      },
      required: ["slot_start", "name", "email"],
    },
  },
  {
    name: "get_live_social_stats",
    description:
      "LIVE lookup of a business's social network numbers (followers, engagement, frequency, last post), compared with what the diagnosis had. Use it to verify figures or when asked about a specific network. It costs one external lookup: do not repeat it unnecessarily.",
    input_schema: {
      type: "object",
      properties: {
        network: { type: "string", enum: ["instagram", "facebook", "tiktok", "youtube"] },
        business: { type: "string", description: "Name (or part of it) of the business or competitor. If omitted, the analyzed business." },
        handle_or_url: { type: "string", description: "Only if not in the diagnosis: username (IG/TikTok) or URL (Facebook/YouTube)." },
      },
      required: ["network"],
    },
  },
  {
    name: "get_live_google_reputation",
    description: "Live lookup of the Google Maps listing of the business or a competitor: rating, number of reviews and website, compared with the diagnosis.",
    input_schema: { type: "object", properties: { business: { type: "string", description: "Name of the business or competitor. Defaults to the analyzed one." } } },
  },
  {
    name: "audit_website_seo",
    description:
      "Checks the basic SEO of the homepage of a diagnosed business's website: title, meta description, H1, restaurant structured data, mobile, sitemap, robots, response speed and content. It only works with sites from the diagnosis.",
    input_schema: { type: "object", properties: { business: { type: "string", description: "Name of the business or competitor. Defaults to the analyzed one." } } },
  },
  {
    name: "check_google_ranking",
    description:
      "Searches Google for a query (e.g. 'mexican restaurant in Portland') and says at what organic position the business's site appears and which competitors show up. It does not include the local map. It costs one external lookup.",
    input_schema: {
      type: "object",
      properties: {
        query: { type: "string", description: "What a customer would search for, with the city." },
        business: { type: "string", description: "Business to locate. Defaults to the analyzed one." },
      },
      required: ["query"],
    },
  },
  {
    name: "search_agency_knowledge",
    description:
      "Searches the material the agency uploaded (services, case studies, prices, guides, policies) and returns the most relevant excerpts. Use it to recommend services, cite cases or answer how the agency works. If it returns nothing, do not invent: say you do not have that information.",
    input_schema: {
      type: "object",
      properties: { query: { type: "string", description: "What to search for, in a few words (e.g. 'Instagram management for restaurants')." } },
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
