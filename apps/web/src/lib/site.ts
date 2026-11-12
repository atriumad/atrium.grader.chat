// Single source of truth for the public identity of the site (metadata, sitemap, structured data).

export const SITE = {
  name: "Atrium Grader",
  shortName: "Atrium",
  tagline: "Free restaurant score vs. your competitors",
  title: "Atrium Grader | Free Restaurant Score vs. Your Competitors",
  description:
    "See how your restaurant's Google reputation and social media stack up against nearby competitors. Get your free Atrium Score in about 40 seconds.",
  // Used when SITE_URL is not set. Production must set SITE_URL to its public address.
  defaultUrl: "https://grader.atriumad.com",
  themeColor: "#f6f4ef",
  locale: "en_US",
} as const

/** Public origin without a trailing slash. */
export function siteUrl(): string {
  const raw = process.env.SITE_URL?.trim().replace(/\/+$/, "")
  if (raw && /^https?:\/\//.test(raw)) return raw
  return SITE.defaultUrl
}

// Questions shown on the home page and published as FAQPage structured data. Keep both in sync:
// Google requires structured data to match what a visitor can read on the page.
export const FAQ: Array<{ q: string; a: string }> = [
  {
    q: "What is the Atrium Score?",
    a: "A number from 0 to 100 that summarizes how strong a restaurant's online presence is. It combines social media engagement, Google reputation, how often and how recently you post, audience size, and how many networks you are active on.",
  },
  {
    q: "How long does the analysis take?",
    a: "About 40 seconds. You watch it happen: Google listing, nearby competitors, social networks, then a written analysis.",
  },
  {
    q: "Which competitors am I compared with?",
    a: "Businesses of the same type found on Google Maps within about 2 miles of yours. Several locations of the same brand count once.",
  },
  {
    q: "Where does the data come from?",
    a: "Your public Google Maps listing and the public profiles of your business and its competitors on Instagram, Facebook, TikTok and YouTube. When something cannot be read, the report says so instead of guessing.",
  },
  {
    q: "Is it free?",
    a: "Yes. Type your business name, pick it from the list, and get the full report. You can also ask follow-up questions and book a meeting with the Atrium team.",
  },
  {
    q: "Can I talk to someone about the results?",
    a: "Yes. After the report, an assistant answers questions about your score and can show real available times to book a 30-minute meeting with the team.",
  },
]
