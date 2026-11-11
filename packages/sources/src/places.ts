// Google Places API (New): find the business and its local competitors.

import type { Place } from "@atrium/shared/types"
import { logEvent } from "./log.ts"
export type { Place }

type RawPlace = {
  id: string
  displayName?: { text?: string }
  formattedAddress?: string
  location?: { latitude: number; longitude: number }
  rating?: number
  userRatingCount?: number
  websiteUri?: string
  primaryType?: string
  googleMapsUri?: string
}

const FIELDS = [
  "places.id",
  "places.displayName",
  "places.formattedAddress",
  "places.location",
  "places.rating",
  "places.userRatingCount",
  "places.websiteUri",
  "places.primaryType",
  "places.googleMapsUri",
].join(",")

function toPlace(p: RawPlace): Place {
  return {
    id: p.id,
    name: p.displayName?.text ?? "Unknown",
    address: p.formattedAddress ?? "",
    lat: p.location?.latitude ?? 0,
    lng: p.location?.longitude ?? 0,
    rating: p.rating ?? null,
    reviews: p.userRatingCount ?? null,
    website: p.websiteUri ?? null,
    primaryType: p.primaryType ?? null,
    mapsUrl: p.googleMapsUri ?? null,
  }
}

async function placesFetch(path: string, body: unknown): Promise<RawPlace[]> {
  const key = process.env.GOOGLE_PLACES_API_KEY
  if (!key) throw new Error("GOOGLE_PLACES_API_KEY is missing")
  // Billed per request: counted so the admin can estimate spend.
  logEvent("places_call", { sku: path.includes("Nearby") ? "nearby" : "text_search" })
  const res = await fetch(`https://places.googleapis.com/v1/${path}`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "X-Goog-Api-Key": key,
      "X-Goog-FieldMask": FIELDS,
    },
    body: JSON.stringify(body),
    signal: AbortSignal.timeout(15_000),
  })
  if (!res.ok) {
    throw new Error(`Google Places ${res.status}: ${(await res.text()).slice(0, 200)}`)
  }
  const json = (await res.json()) as { places?: RawPlace[] }
  return json.places ?? []
}

export async function findBusiness(query: string): Promise<Place | null> {
  const places = await placesFetch("places:searchText", {
    textQuery: query,
    maxResultCount: 1,
  })
  return places[0] ? toPlace(places[0]) : null
}

export async function findCompetitors(
  business: Place,
  limit = 5,
  radiusMeters = 3000
): Promise<Place[]> {
  const places = await placesFetch("places:searchNearby", {
    includedTypes: [business.primaryType ?? "restaurant"],
    maxResultCount: 20,
    rankPreference: "POPULARITY",
    locationRestriction: {
      circle: {
        center: { latitude: business.lat, longitude: business.lng },
        radius: radiusMeters,
      },
    },
  })
  return places
    .map(toPlace)
    .filter((p) => p.id !== business.id)
    .sort((a, b) => (b.reviews ?? 0) - (a.reviews ?? 0))
    .slice(0, limit)
}

// Several candidates for one text query, so the caller can disambiguate.
export async function findCandidates(query: string, limit = 5): Promise<Place[]> {
  const places = await placesFetch("places:searchText", {
    textQuery: query,
    maxResultCount: limit,
  })
  return places.map(toPlace)
}

// A specific place the user picked.
export async function getPlace(id: string): Promise<Place | null> {
  const key = process.env.GOOGLE_PLACES_API_KEY
  if (!key) throw new Error("GOOGLE_PLACES_API_KEY is missing")
  if (!/^[A-Za-z0-9_-]{10,200}$/.test(id)) return null
  logEvent("places_call", { sku: "details" })
  const res = await fetch(`https://places.googleapis.com/v1/places/${id}`, {
    headers: {
      "X-Goog-Api-Key": key,
      "X-Goog-FieldMask":
        "id,displayName,formattedAddress,location,rating,userRatingCount,websiteUri,primaryType,googleMapsUri",
    },
    signal: AbortSignal.timeout(15_000),
  })
  if (res.status === 404) return null
  if (!res.ok) throw new Error(`Google Places ${res.status}: ${(await res.text()).slice(0, 200)}`)
  return toPlace((await res.json()) as RawPlace)
}

export type PlaceSuggestion = { placeId: string; name: string; detail: string }

// Autocomplete (New) for the search box: the owner types the business name and picks the
// listing, so no text matching is needed. US only; `near` (visitor's approximate location)
// only ranks nearby results first, it never filters.
export async function suggestPlaces(
  input: string,
  opts: { sessionToken?: string; near?: { lat: number; lng: number } } = {}
): Promise<PlaceSuggestion[]> {
  const key = process.env.GOOGLE_PLACES_API_KEY
  if (!key) throw new Error("GOOGLE_PLACES_API_KEY is missing")
  logEvent("places_call", { sku: "autocomplete" })
  const res = await fetch("https://places.googleapis.com/v1/places:autocomplete", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "X-Goog-Api-Key": key,
      "X-Goog-FieldMask":
        "suggestions.placePrediction.placeId,suggestions.placePrediction.structuredFormat",
    },
    body: JSON.stringify({
      input,
      includedRegionCodes: ["us"],
      includedPrimaryTypes: ["restaurant", "cafe", "bar", "bakery", "meal_takeaway"],
      ...(opts.sessionToken ? { sessionToken: opts.sessionToken } : {}),
      ...(opts.near
        ? { locationBias: { circle: { center: { latitude: opts.near.lat, longitude: opts.near.lng }, radius: 50000 } } }
        : {}),
    }),
    signal: AbortSignal.timeout(8_000),
  })
  if (!res.ok) throw new Error(`Google Places ${res.status}: ${(await res.text()).slice(0, 200)}`)
  const json = (await res.json()) as {
    suggestions?: Array<{
      placePrediction?: {
        placeId?: string
        structuredFormat?: { mainText?: { text?: string }; secondaryText?: { text?: string } }
      }
    }>
  }
  return (json.suggestions ?? []).flatMap((s) => {
    const p = s.placePrediction
    if (!p?.placeId || !p.structuredFormat?.mainText?.text) return []
    return [{ placeId: p.placeId, name: p.structuredFormat.mainText.text, detail: p.structuredFormat.secondaryText?.text ?? "" }]
  })
}
