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
// `instagramOnly` skips Facebook/TikTok/YouTube: used for competitors, where Instagram is enough
// to compare and every extra network is billed.
export async function readSocials(place: Pick<Place, "name" | "address" | "website">, opts: { instagramOnly?: boolean } = {}): Promise<Socials> {
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
            ? { instagram: null, instagramNote: `Instagram could not be searched on Google (${searchFailure})`, instagramFailure: searchFailure }
            : { instagram: null, instagramNote: "Instagram was not found on its website or on Google" }
        ),
    opts.instagramOnly ? Promise.resolve({ networks: [] as NetworkStats[], note: undefined }) : getNetworkStats(links),
  ])
  return { ...instagram, networks: others.networks, networksNote: others.note }
}
