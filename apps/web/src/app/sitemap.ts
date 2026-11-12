import type { MetadataRoute } from "next"

import { siteUrl } from "@/lib/site"

// One public page. Add a route here when a new indexable page is created.
export default function sitemap(): MetadataRoute.Sitemap {
  return [{ url: siteUrl(), changeFrequency: "monthly", priority: 1 }]
}
