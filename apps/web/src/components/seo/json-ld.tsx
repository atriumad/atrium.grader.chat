import { FAQ, SITE, siteUrl } from "@/lib/site"

// Structured data for the home page. `<` is escaped so no text can close the script tag.
const safe = (o: unknown) => JSON.stringify(o).replace(/</g, "\\u003c")

export function HomeJsonLd() {
  const url = siteUrl()
  const graph = {
    "@context": "https://schema.org",
    "@graph": [
      {
        "@type": "Organization",
        "@id": `${url}/#organization`,
        name: "Atrium",
        url,
      },
      {
        "@type": "WebSite",
        "@id": `${url}/#website`,
        url,
        name: SITE.name,
        description: SITE.description,
        inLanguage: "en-US",
        publisher: { "@id": `${url}/#organization` },
      },
      {
        "@type": "WebApplication",
        "@id": `${url}/#app`,
        name: SITE.name,
        url,
        description: SITE.description,
        applicationCategory: "BusinessApplication",
        operatingSystem: "Any",
        offers: { "@type": "Offer", price: "0", priceCurrency: "USD" },
        publisher: { "@id": `${url}/#organization` },
      },
      {
        "@type": "FAQPage",
        mainEntity: FAQ.map((f) => ({ "@type": "Question", name: f.q, acceptedAnswer: { "@type": "Answer", text: f.a } })),
      },
    ],
  }
  return <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: safe(graph) }} />
}
