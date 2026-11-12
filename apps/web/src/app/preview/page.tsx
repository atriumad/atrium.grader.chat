"use client"

import { Logo } from "@/components/brand/logo"
import { Prose } from "@/components/results/prose"
import { Report } from "@/components/results/report"
import { Button } from "@/components/ui/button"
import type { Dataset } from "@/lib/analysis"

// A finished report built from fixed data: lets you review the dashboard without spending
// provider credits. The real flow lives in the home page.
const FIXTURE_DATA: Dataset = {
  mode: "business_name", queried: "Screen Door", identification: "Business picked by the user on Google Maps: Screen Door Pearl District, Portland, OR",
  competitorsSource: "nearby businesses of the same type on Google Maps (within 1.9 miles)", generatedAt: "",
  business: { name: "Screen Door Pearl District", place: { id: "a", name: "Screen Door", address: "1131 NW Couch St, Portland", lat: 45.5236, lng: -122.6821, rating: 4.6, reviews: 1965, website: null, primaryType: null, mapsUrl: null },
    instagram: { handle: "screendoorpdx", followers: 48200, totalPosts: 900, category: null, verified: false, postsSampled: 12, avgLikes: 100, avgComments: 4, avgViews: null, engagementRatePct: 0.4, postsPerWeek: 0.6, lastPostDaysAgo: 20 }, instagramNote: "ok" },
  competitors: [
    { name: "Mother's Bistro & Bar", place: { id: "b", name: "Mothers", address: "SW 3rd", lat: 45.5207, lng: -122.679, rating: 4.6, reviews: 3120, website: null, primaryType: null, mapsUrl: null },
      instagram: { handle: "mothersbistro", followers: 21400, totalPosts: 500, category: null, verified: false, postsSampled: 12, avgLikes: 600, avgComments: 20, avgViews: null, engagementRatePct: 2.9, postsPerWeek: 3.1, lastPostDaysAgo: 1 }, instagramNote: "ok" },
    { name: "Cheryl's on 12th", place: { id: "c", name: "Cheryls", address: "SW Washington", lat: 45.512, lng: -122.684, rating: 4.5, reviews: 1480, website: null, primaryType: null, mapsUrl: null },
      instagram: { handle: "cherylson12th", followers: 9800, totalPosts: 300, category: null, verified: false, postsSampled: 12, avgLikes: 300, avgComments: 15, avgViews: null, engagementRatePct: 3.4, postsPerWeek: 5.2, lastPostDaysAgo: 1 }, instagramNote: "ok" },
  ],
}
const FIXTURE_TEXT = "## Summary\nScreen Door ranks **3rd of 3**: it has the biggest audience but barely engages or posts.\n\n## What lifts and what drags your score\n- **Lifts:** 48K followers.\n- **Drags:** 0.4% engagement and one post every 20 days.\n\n## The 3 actions that matter most\n1. **Post 3 times a week.** Your rivals do, and it shows.\n2. **Ask for opinions in your captions.** Your engagement is the lowest.\n3. **Restart the account this week.** You have gone 20 days without posting."

export default function PreviewPage() {
  return (
    <main className="flex min-h-svh flex-col bg-background">
      <header className="sticky top-0 z-20 shrink-0 border-b bg-background/90 backdrop-blur">
      <div className="mx-auto flex h-14 w-full max-w-[1400px] items-center justify-between px-4 sm:px-6">
        <Logo variant="wordmark" size={20} />
        <div className="flex items-center gap-2">
          <Button variant="outline" size="sm">Ask</Button>
          <Button variant="ghost" size="sm">New analysis</Button>
        </div>
      </div>
      </header>
      <div className="mx-auto w-full max-w-[1400px] flex-1 px-4 pt-6 pb-16 sm:px-6">
        <Report data={FIXTURE_DATA} onAsk={() => {}}>
          <Prose text={FIXTURE_TEXT} streaming={false} />
        </Report>
      </div>
    </main>
  )
}
