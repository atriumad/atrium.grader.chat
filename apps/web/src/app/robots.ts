import type { MetadataRoute } from "next"

import { siteUrl } from "@/lib/site"

// Only the home page is meant to be found. Reports, chat and the admin are per visitor or private.
export default function robots(): MetadataRoute.Robots {
  const base = siteUrl()
  return {
    rules: { userAgent: "*", allow: "/", disallow: ["/admin", "/api/", "/preview"] },
    sitemap: `${base}/sitemap.xml`,
    host: base,
  }
}
