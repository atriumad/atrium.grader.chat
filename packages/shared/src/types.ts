// Shapes shared by the web API and both UIs. Single source of truth.
export type Place = {
  id: string
  name: string
  address: string
  lat: number
  lng: number
  rating: number | null
  reviews: number | null
  website: string | null
  primaryType: string | null
  mapsUrl: string | null
}

export type InstagramStats = {
  handle: string
  followers: number | null
  totalPosts: number | null
  category: string | null
  verified: boolean | null
  postsSampled: number
  avgLikes: number | null
  avgComments: number | null
  avgViews: number | null
  engagementRatePct: number | null
  postsPerWeek: number | null
  lastPostDaysAgo: number | null
}

// Facebook, TikTok and YouTube. Instagram keeps its own shape (InstagramStats).
export type Network = "facebook" | "tiktok" | "youtube"

export type NetworkStats = {
  network: Network
  handle: string
  followers: number | null
  postsSampled: number
  avgLikes: number | null
  avgComments: number | null
  avgViews: number | null
  engagementRatePct: number | null
  postsPerWeek: number | null
  lastPostDaysAgo: number | null
}

export type Entity = {
  name: string
  // Google Places data. null when the business has no confirmed Google listing.
  place: Place | null
  instagram: InstagramStats | null
  instagramNote: string
  // Other networks found on the business website. Absent when none were read.
  networks?: NetworkStats[]
  networksNote?: string
}

export type Dataset = {
  // How the business was identified, so the analysis can state it.
  mode: "instagram_handle" | "business_name"
  queried: string
  identification: string
  business: Entity
  competitorsSource: string
  competitors: Entity[]
  generatedAt: string
  // Scoring rules published in the admin panel when this was generated (JSON-safe).
  scoring?: unknown
}
