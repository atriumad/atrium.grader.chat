import { suggestPlaces } from "@/lib/places"
import { allow, clientKey } from "@/lib/rate-limit"

// Suggestions for the search box. The Google key stays on the server.
export async function GET(req: Request) {
  const url = new URL(req.url)
  const q = (url.searchParams.get("q") ?? "").trim()
  const token = url.searchParams.get("token") ?? undefined
  if (q.length < 2 || q.length > 100) return Response.json({ suggestions: [] })
  if (!allow(`places:${clientKey(req)}`, 60, 60_000)) {
    return Response.json({ error: "Too many searches, wait a moment" }, { status: 429 })
  }
  // Vercel adds the visitor's approximate location; absent locally.
  const lat = Number(req.headers.get("x-vercel-ip-latitude"))
  const lng = Number(req.headers.get("x-vercel-ip-longitude"))
  const near = Number.isFinite(lat) && Number.isFinite(lng) && (lat || lng) ? { lat, lng } : undefined
  try {
    const suggestions = await suggestPlaces(q, { sessionToken: token && /^[\w-]{8,64}$/.test(token) ? token : undefined, near })
    return Response.json({ suggestions })
  } catch (e) {
    console.error("[places] autocomplete failed:", e instanceof Error ? e.message : e)
    return Response.json({ suggestions: [] })
  }
}
