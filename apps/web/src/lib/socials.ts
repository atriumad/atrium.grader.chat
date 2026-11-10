// The lookups live in @atrium/sources. This registers the web app's logger (Supabase lookup_logs) with it.
import { setLogger } from "@atrium/sources/log"
import { logEvent, logLookup } from "@/lib/admin/log"

setLogger({ logLookup, logEvent })

export * from "@atrium/sources/socials"
