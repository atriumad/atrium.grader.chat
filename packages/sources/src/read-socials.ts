import type { InstagramStats, NetworkStats, Place } from "@atrium/shared/types"
import { classifyError, type FailureClass } from "./errors.ts"
import { findSocialLinks, getInstagramStats, getNetworkStats, searchInstagramHandle } from "./socials.ts"

export type Socials = {
  instagram: InstagramStats | null
  instagramNote: string
  // Set when Instagram could not be read because a provider failed (not because the business has none).
  instagramFailure?: FailureClass
  networks: NetworkStats[]
  networksNote: string | undefined
}

const errMsg = (e: unknown) => (e instanceof Error ? e.message : "error")

// Reads every social network of a business. Instagram is the anchor; the other networks add to it.
// Order: links on the website (home page too), then a name-validated Google search.
export async function readSocials(place: Pick<Place, "name" | "address" | "website">): Promise<Socials> {
  const links = await findSocialLinks(place.website)
  let searchFailure: FailureClass | undefined
  if (!links.instagram) {
    try {
      links.instagram = await searchInstagramHandle(place.name, place.address)
    } catch (e) {
      searchFailure = classifyError(e)
    }
  }

  const [instagram, others] = await Promise.all([
    links.instagram
      ? getInstagramStats(links.instagram).then(
          (s): Pick<Socials, "instagram" | "instagramNote" | "instagramFailure"> => ({ instagram: s, instagramNote: "ok" }),
          (e): Pick<Socials, "instagram" | "instagramNote" | "instagramFailure"> => ({
            instagram: null,
            instagramNote: `Instagram @${links.instagram} no disponible: ${errMsg(e)}`,
            instagramFailure: classifyError(e),
          })
        )
      : Promise.resolve<Pick<Socials, "instagram" | "instagramNote" | "instagramFailure">>(
          searchFailure
            ? { instagram: null, instagramNote: `No se pudo buscar Instagram en Google (${searchFailure})`, instagramFailure: searchFailure }
            : { instagram: null, instagramNote: "No se encontró Instagram ni en su sitio web ni en Google" }
        ),
    getNetworkStats(links),
  ])
  return { ...instagram, networks: others.networks, networksNote: others.note }
}
